import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { EnvVars } from '@config/env.validation';

// ─────────────────────────────────────────────────────────────────────────────
// StorageService — MinIO-backed object storage.
//
// Consumers call `storage.upload({ bucket, keyPrefix, buffer, mimeType,
// originalName, metadata })` and get back `{ url, key, bucket, size }`.
//
// `bucket` is a LOGICAL name (`photos`, `certificates`, `videos`,
// `documents`) which we map to the real MinIO bucket names configured
// via env vars (MINIO_BUCKET_PHOTOS, ...). This keeps call sites tidy
// and lets us rename underlying buckets without touching business code.
// ─────────────────────────────────────────────────────────────────────────────

export type StorageBucketAlias = 'photos' | 'certificates' | 'videos' | 'documents';

export interface UploadInput {
  bucket: StorageBucketAlias;
  keyPrefix: string;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  bucket: string;
  key: string;
  url: string;
  size: number;
  etag?: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: Minio.Client;
  private readonly bucketMap: Record<StorageBucketAlias, string>;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService<EnvVars, true>) {
    this.bucketMap = {
      photos: this.config.get('MINIO_BUCKET_PHOTOS', { infer: true }),
      certificates: this.config.get('MINIO_BUCKET_CERTIFICATES', { infer: true }),
      videos: this.config.get('MINIO_BUCKET_VIDEOS', { infer: true }),
      documents: this.config.get('MINIO_BUCKET_DOCUMENTS', { infer: true }),
    };
    this.publicBaseUrl = this.config
      .get('MINIO_PUBLIC_URL', { infer: true })
      .replace(/\/+$/, '');
  }

  onModuleInit(): void {
    this.client = new Minio.Client({
      endPoint: this.config.get('MINIO_ENDPOINT', { infer: true }),
      port: this.config.get('MINIO_PORT', { infer: true }),
      useSSL: this.config.get('MINIO_USE_SSL', { infer: true }),
      accessKey: this.config.get('MINIO_ACCESS_KEY', { infer: true }),
      secretKey: this.config.get('MINIO_SECRET_KEY', { infer: true }),
    });
    this.logger.log(
      `MinIO client ready at ${this.config.get('MINIO_ENDPOINT', { infer: true })}:${this.config.get(
        'MINIO_PORT',
        { infer: true },
      )}`,
    );
  }

  // ── Public API ──────────────────────────────────────────────────────────
  async upload(input: UploadInput): Promise<UploadResult> {
    const bucket = this.resolveBucket(input.bucket);
    const key = this.buildKey(input.keyPrefix, input.originalName);

    try {
      const metaHeaders: Record<string, string> = {
        'Content-Type': input.mimeType,
      };
      if (input.metadata) {
        for (const [k, v] of Object.entries(input.metadata)) {
          // MinIO custom metadata is prefixed with X-Amz-Meta- automatically
          // when placed under a plain header key.
          metaHeaders[`X-Amz-Meta-${k}`] = v;
        }
      }

      const info = await this.client.putObject(
        bucket,
        key,
        input.buffer,
        input.buffer.length,
        metaHeaders,
      );

      return {
        bucket,
        key,
        url: `${this.publicBaseUrl}/${bucket}/${key}`,
        size: input.buffer.length,
        etag: info.etag,
      };
    } catch (err) {
      this.logger.error(
        `Failed to upload ${input.originalName} to ${bucket}/${key}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  async delete(bucketAlias: StorageBucketAlias, key: string): Promise<void> {
    const bucket = this.resolveBucket(bucketAlias);
    try {
      await this.client.removeObject(bucket, key);
    } catch (err) {
      this.logger.error(
        `Failed to delete ${bucket}/${key}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new InternalServerErrorException('Failed to delete file');
    }
  }

  async getPresignedUrl(
    bucketAlias: StorageBucketAlias,
    key: string,
    expiresSeconds = 60 * 60,
  ): Promise<string> {
    const bucket = this.resolveBucket(bucketAlias);
    return this.client.presignedGetObject(bucket, key, expiresSeconds);
  }

  publicUrlFor(bucketAlias: StorageBucketAlias, key: string): string {
    return `${this.publicBaseUrl}/${this.resolveBucket(bucketAlias)}/${key}`;
  }

  // ── Internals ───────────────────────────────────────────────────────────
  private resolveBucket(alias: StorageBucketAlias): string {
    const bucket = this.bucketMap[alias];
    if (!bucket) {
      throw new InternalServerErrorException(`Unknown storage bucket alias: ${alias}`);
    }
    return bucket;
  }

  // We keep the original file extension for downstream tooling (image
  // pipelines, browsers sniffing PDF viewers, etc.) and prepend a UUID
  // so concurrent uploads with identical names never collide.
  private buildKey(keyPrefix: string, originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const base = path.basename(originalName, ext).replace(/[^a-z0-9-_]+/gi, '-').slice(0, 40) || 'file';
    const trimmedPrefix = keyPrefix.replace(/^\/+|\/+$/g, '');
    return `${trimmedPrefix}/${randomUUID()}-${base}${ext}`;
  }
}

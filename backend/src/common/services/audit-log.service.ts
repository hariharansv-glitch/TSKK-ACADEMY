import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';

interface RecordInput {
  academyId?: string | null;
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/**
 * Writes an entry to `audit_logs`. Failures are logged but never thrown —
 * audit logging must never break a mutating request.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          academyId: input.academyId ?? null,
          userId: input.userId ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          before: input.before ? (input.before as Prisma.InputJsonValue) : Prisma.JsonNull,
          after: input.after ? (input.after as Prisma.InputJsonValue) : Prisma.JsonNull,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          requestId: input.requestId ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log: ${(err as Error).message}`);
    }
  }

  /** Convenience for controllers: derive user + request context from an authed request. */
  async fromRequest(
    req: AuthenticatedRequest,
    action: AuditAction,
    entityType: string,
    entityId: string | null | undefined,
    payload: { before?: unknown; after?: unknown } = {},
  ): Promise<void> {
    await this.record({
      academyId: req.user?.academyId ?? req.tenantId ?? null,
      userId: req.user?.id ?? null,
      action,
      entityType,
      entityId,
      before: payload.before,
      after: payload.after,
      ipAddress: (req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip) ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      requestId: req.requestId ?? null,
    });
  }
}

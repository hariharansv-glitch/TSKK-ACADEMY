import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: unknown;
  requestId?: string;
  timestamp: string;
}

/**
 * Wraps every successful controller response in a consistent envelope.
 * Preserves the raw `data` / `meta` shape of DTOs like PaginatedResponseDto.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiEnvelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiEnvelope<T>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((payload) => {
        if (this.isRawResponse(payload) || response.headersSent) {
          return payload as unknown as ApiEnvelope<T>;
        }
        if (this.isEnvelopeShaped(payload)) {
          return {
            success: true,
            data: (payload as { data: T }).data,
            meta: (payload as { meta?: unknown }).meta,
            requestId: request.requestId,
            timestamp: new Date().toISOString(),
          };
        }
        return {
          success: true,
          data: payload,
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }

  private isRawResponse(payload: unknown): boolean {
    if (!payload) return false;
    if (Buffer.isBuffer(payload)) return true;
    if (typeof payload === 'string') return true;
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'pipe' in payload &&
      typeof (payload as { pipe: unknown }).pipe === 'function'
    ) {
      return true;
    }
    return false;
  }

  private isEnvelopeShaped(payload: unknown): boolean {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'data' in payload &&
      'meta' in payload
    );
  }
}

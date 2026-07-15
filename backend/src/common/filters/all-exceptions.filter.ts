import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  method: string;
  timestamp: string;
  requestId?: string;
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<AuthenticatedRequest>();

    const body = this.buildErrorBody(exception, request);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${body.method} ${body.path} → ${body.statusCode} ${JSON.stringify(body.message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${body.method} ${body.path} → ${body.statusCode} ${JSON.stringify(body.message)}`);
    }

    response.status(body.statusCode).json(body);
  }

  private buildErrorBody(exception: unknown, request: AuthenticatedRequest): ErrorBody {
    const base = {
      path: request.originalUrl,
      method: request.method,
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
    };

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { ...base, statusCode: status, error: exception.name, message: res };
      }
      const obj = res as Record<string, unknown>;
      return {
        ...base,
        statusCode: status,
        error: (obj.error as string) ?? exception.name,
        message: (obj.message as string | string[]) ?? 'Error',
        details: (obj as { issues?: unknown; details?: unknown }).issues ?? obj.details,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaKnownError(exception, base);
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        ...base,
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'ValidationError',
        message: 'Invalid data supplied to the database',
      };
    }
    if (exception instanceof Error) {
      return {
        ...base,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: exception.name || 'InternalServerError',
        message: exception.message || 'Unexpected error',
      };
    }
    return {
      ...base,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'InternalServerError',
      message: 'Unexpected error',
    };
  }

  private mapPrismaKnownError(
    err: Prisma.PrismaClientKnownRequestError,
    base: Omit<ErrorBody, 'statusCode' | 'error' | 'message'>,
  ): ErrorBody {
    switch (err.code) {
      case 'P2002':
        return {
          ...base,
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'A record with the provided unique field already exists',
          details: err.meta,
        };
      case 'P2025':
        return {
          ...base,
          statusCode: HttpStatus.NOT_FOUND,
          error: 'NotFound',
          message: 'The requested resource could not be found',
          details: err.meta,
        };
      case 'P2003':
        return {
          ...base,
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'ForeignKeyViolation',
          message: 'A referenced record does not exist',
          details: err.meta,
        };
      default:
        return {
          ...base,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'DatabaseError',
          message: `Database error (${err.code})`,
        };
    }
  }
}

import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * @Tenant() — returns the academyId scoped to the current request.
 *
 * Super admins operating on their own super-admin surface may have a null
 * academyId. Callers that need a non-null value can call `@Tenant({ required: true })`.
 */
export const Tenant = createParamDecorator(
  (opts: { required?: boolean } | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const academyId = req.user?.academyId ?? req.tenantId ?? null;
    if (opts?.required && !academyId) {
      throw new ForbiddenException('Request is missing a tenant scope');
    }
    return academyId;
  },
);

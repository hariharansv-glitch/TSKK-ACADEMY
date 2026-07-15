import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * TenantGuard — enforces that non-super-admin users always carry an academyId,
 * and cross-tenant access is impossible.
 *
 * If a request contains `:academyId` in the path or `x-academy-id` header, we
 * assert it equals the JWT's academyId (super admins may override).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Missing authenticated user');

    const claimedAcademy =
      (request.params?.academyId as string | undefined) ??
      (request.headers['x-academy-id'] as string | undefined) ??
      null;

    if (user.role === UserRole.SUPER_ADMIN) {
      request.tenantId = claimedAcademy ?? user.academyId ?? null;
      return true;
    }

    if (!user.academyId) {
      throw new ForbiddenException('User has no academy tenant');
    }
    if (claimedAcademy && claimedAcademy !== user.academyId) {
      throw new ForbiddenException('Cross-tenant access denied');
    }
    request.tenantId = user.academyId;
    return true;
  }
}

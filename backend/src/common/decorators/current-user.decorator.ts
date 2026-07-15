import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest, AuthenticatedUser } from '../types/authenticated-request';

/**
 * @CurrentUser() — returns the authenticated user, or throws 401 if missing.
 * @CurrentUser('id') — returns a single property of the user.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) throw new UnauthorizedException('Missing authenticated user');
    return data ? user[data] : user;
  },
);

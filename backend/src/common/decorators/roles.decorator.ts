import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export const ROLES_KEY = 'auth:roles';

/** Restrict a route to one or more roles. Multiple roles are OR-combined. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

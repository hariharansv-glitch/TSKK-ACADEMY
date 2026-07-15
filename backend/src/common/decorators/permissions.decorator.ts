import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'auth:permissions';

/** Require every listed permission key (AND semantics). */
export const Permissions = (...keys: string[]) => SetMetadata(PERMISSIONS_KEY, keys);

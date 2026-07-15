import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';

/** Route decorator to mark an endpoint as accessible without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

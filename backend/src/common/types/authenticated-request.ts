import type { Request } from 'express';
import type { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  academyId: string | null;
  sessionId?: string;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  requestId?: string;
  tenantId?: string | null;
}

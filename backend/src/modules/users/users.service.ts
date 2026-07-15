import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { MailerService } from '@modules/mailer/mailer.service';
import { PermissionsService } from '@modules/auth/services/permissions.service';
import { AuditLogService } from '@common/services/audit-log.service';
import { hashPassword } from '@common/utils/password.util';
import { randomToken, sha256 } from '@common/utils/hash.util';
import { paginate } from '@common/dto/paginated-response.dto';
import type { EnvVars } from '@config/env.validation';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';
import type {
  CreateUserInput,
  ListUsersQuery,
  SetRoleInput,
  SetStatusInput,
  UpdateUserInput,
} from './dto/user.dto';

const USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  status: true,
  academyId: true,
  emailVerified: true,
  phoneVerified: true,
  locale: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly audit: AuditLogService,
    private readonly permissions: PermissionsService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────
  async create(
    academyId: string | null,
    input: CreateUserInput,
    actor: AuthenticatedUser,
    req: AuthenticatedRequest,
  ) {
    this.assertCanAssignRole(actor.role, input.role);
    if (input.role !== UserRole.SUPER_ADMIN && !academyId) {
      throw new BadRequestException('academyId is required for non-super-admin users');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('A user with this email already exists');

    if (academyId) {
      const sub = await this.prisma.subscription.findUnique({ where: { academyId } });
      if (sub) {
        const seatsUsed = await this.prisma.user.count({
          where: { academyId, deletedAt: null, status: { not: UserStatus.SUSPENDED } },
        });
        if (seatsUsed >= sub.seatLimit) {
          throw new ForbiddenException(`Seat limit reached (${sub.seatLimit})`);
        }
      }
    }

    const tempRaw = randomToken(24);
    const passwordHash = await hashPassword(`${tempRaw}A1!`);

    const user = await this.prisma.user.create({
      data: {
        academyId: input.role === UserRole.SUPER_ADMIN ? null : academyId,
        email: input.email,
        phone: input.phone,
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: `${input.firstName} ${input.lastName}`,
        passwordHash,
        role: input.role,
        status: UserStatus.PENDING_VERIFICATION,
        locale: input.locale ?? 'en',
      },
      select: USER_SELECT,
    });

    const resetRaw = randomToken(32);
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: sha256(resetRaw),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    if (input.sendInvite !== false) {
      const resetUrl = `${this.config.get('APP_URL', { infer: true })}/auth/reset-password?token=${resetRaw}`;
      await this.mailer
        .sendTemplate(user.email, 'reset-password', {
          firstName: user.firstName,
          email: user.email,
          resetUrl,
          expiresInMinutes: 24 * 60,
          requestIp: null,
        })
        .catch((err) => this.logger.warn(`Invite mail failed: ${(err as Error).message}`));
    }

    await this.audit.fromRequest(req, 'CREATE', 'User', user.id, { after: user });
    return user;
  }

  // ── List / detail ─────────────────────────────────────────────────────────
  async list(academyId: string | null, actor: AuthenticatedUser, query: ListUsersQuery) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(actor.role === UserRole.SUPER_ADMIN ? {} : { academyId }),
      ...(academyId && actor.role === UserRole.SUPER_ADMIN ? { academyId } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.UserOrderByWithRelationInput = query.sortBy
      ? ({ [query.sortBy]: query.sortDir } as Prisma.UserOrderByWithRelationInput)
      : { createdAt: 'desc' };

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: USER_SELECT,
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async findById(id: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    this.assertVisibility(actor, user.academyId);
    return user;
  }

  // ── Update self / profile ─────────────────────────────────────────────────
  async update(id: string, input: UpdateUserInput, actor: AuthenticatedUser, req: AuthenticatedRequest) {
    const target = await this.findById(id, actor);
    if (actor.id !== id && actor.role !== UserRole.SUPER_ADMIN && actor.role !== UserRole.ACADEMY_ADMIN) {
      throw new ForbiddenException('Only admins can update other users');
    }
    const after = await this.prisma.user.update({
      where: { id },
      data: input as Prisma.UserUpdateInput,
      select: USER_SELECT,
    });
    await this.audit.fromRequest(req, 'UPDATE', 'User', id, { before: target, after });
    return after;
  }

  // ── Role management ───────────────────────────────────────────────────────
  async setRole(id: string, input: SetRoleInput, actor: AuthenticatedUser, req: AuthenticatedRequest) {
    const target = await this.findById(id, actor);
    if (target.id === actor.id) throw new BadRequestException('You cannot change your own role');
    this.assertCanAssignRole(actor.role, input.role);
    const after = await this.prisma.user.update({
      where: { id },
      data: { role: input.role },
      select: USER_SELECT,
    });
    this.permissions.invalidate();
    await this.audit.fromRequest(req, 'PERMISSION_GRANT', 'User', id, {
      before: { role: target.role },
      after: { role: after.role },
    });
    return after;
  }

  // ── Status ────────────────────────────────────────────────────────────────
  async setStatus(id: string, input: SetStatusInput, actor: AuthenticatedUser, req: AuthenticatedRequest) {
    const target = await this.findById(id, actor);
    if (target.id === actor.id && input.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('You cannot suspend or deactivate your own account');
    }
    const after = await this.prisma.user.update({
      where: { id },
      data: { status: input.status },
      select: USER_SELECT,
    });
    await this.audit.fromRequest(req, 'UPDATE', 'User', id, {
      before: { status: target.status },
      after: { status: after.status, reason: input.reason },
    });
    return after;
  }

  // ── Soft delete ───────────────────────────────────────────────────────────
  async remove(id: string, actor: AuthenticatedUser, req: AuthenticatedRequest) {
    const target = await this.findById(id, actor);
    if (target.id === actor.id) throw new BadRequestException('You cannot delete your own account');
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: UserStatus.INACTIVE },
    });
    await this.audit.fromRequest(req, 'DELETE', 'User', id, { before: target });
    return { deleted: true };
  }

  // ── Sessions (self-service) ───────────────────────────────────────────────
  async listMySessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true, userAgent: true, ipAddress: true, device: true,
        location: true, lastActiveAt: true, createdAt: true, expiresAt: true,
      },
    });
  }

  async revokeMySession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('Session not found');
    await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    return { revoked: true };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private assertVisibility(actor: AuthenticatedUser, targetAcademyId: string | null): void {
    if (actor.role === UserRole.SUPER_ADMIN) return;
    if (targetAcademyId !== actor.academyId) {
      throw new ForbiddenException('You cannot access users from another academy');
    }
  }

  private assertCanAssignRole(actorRole: UserRole, targetRole: UserRole): void {
    const rank: Record<UserRole, number> = {
      SUPER_ADMIN: 100,
      ACADEMY_ADMIN: 80,
      ACCOUNTANT: 60,
      RECEPTIONIST: 55,
      INSTRUCTOR: 50,
      PARENT: 20,
      STUDENT: 10,
    };
    if (rank[actorRole] < rank[targetRole]) {
      throw new ForbiddenException(`You cannot assign the ${targetRole} role`);
    }
    if (targetRole === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can create super admins');
    }
  }
}

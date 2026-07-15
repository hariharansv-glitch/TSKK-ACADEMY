import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AcademyStatus,
  Prisma,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { AuditLogService } from '@common/services/audit-log.service';
import { MailerService } from '@modules/mailer/mailer.service';
import { hashPassword } from '@common/utils/password.util';
import { randomToken, sha256 } from '@common/utils/hash.util';
import { slugify } from '@common/utils/ids.util';
import { paginate } from '@common/dto/paginated-response.dto';
import type { EnvVars } from '@config/env.validation';
import type { AuthenticatedRequest } from '@common/types/authenticated-request';
import type { CreateAcademyInput } from './dto/create-academy.dto';
import type { UpdateAcademyInput } from './dto/update-academy.dto';
import type { ListAcademiesQuery } from './dto/list-academies.dto';
import type { UpdateSubscriptionInput } from './dto/subscription.dto';

const DEFAULT_WORKING_HOURS = {
  MONDAY:    { open: '06:00', close: '21:00' },
  TUESDAY:   { open: '06:00', close: '21:00' },
  WEDNESDAY: { open: '06:00', close: '21:00' },
  THURSDAY:  { open: '06:00', close: '21:00' },
  FRIDAY:    { open: '06:00', close: '21:00' },
  SATURDAY:  { open: '06:00', close: '20:00' },
  SUNDAY:    { open: '07:00', close: '13:00' },
};

@Injectable()
export class AcademiesService {
  private readonly logger = new Logger(AcademiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────
  async create(input: CreateAcademyInput, req: AuthenticatedRequest) {
    const slug = await this.ensureUniqueSlug(input.slug ?? slugify(input.name));
    const trialDays = input.subscription?.trialDays ?? 14;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    const initialStatus: AcademyStatus = trialDays > 0 ? AcademyStatus.TRIAL : AcademyStatus.ACTIVE;

    const result = await this.prisma.$transaction(async (tx) => {
      const academy = await tx.academy.create({
        data: {
          slug,
          name: input.name,
          discipline: input.discipline,
          status: initialStatus,
          primaryColor: input.primaryColor ?? '#B91C1C',
          logoUrl: input.logoUrl,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          websiteUrl: input.websiteUrl,
          registrationNumber: input.registrationNumber,
          taxNumber: input.taxNumber,
          foundedYear: input.foundedYear,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          state: input.state,
          country: input.country,
          postalCode: input.postalCode,
          timezone: input.timezone,
          currency: input.currency,
          trialEndsAt,
        },
      });

      await tx.branch.create({
        data: {
          academyId: academy.id,
          code: 'HQ',
          name: `${academy.name} — Head Office`,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          state: input.state,
          country: input.country,
          postalCode: input.postalCode,
          phone: input.contactPhone,
          email: input.contactEmail,
          isPrimary: true,
        },
      });

      await tx.subscription.create({
        data: {
          academyId: academy.id,
          plan: input.subscription?.plan ?? SubscriptionPlan.STARTER,
          status: trialDays > 0 ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
          seatLimit: input.subscription?.seatLimit ?? 50,
          pricePaise: input.subscription?.pricePaise ?? 0,
          currentPeriodEnd: trialEndsAt,
        },
      });

      await tx.academySetting.create({
        data: {
          academyId: academy.id,
          workingHoursJson: DEFAULT_WORKING_HOURS,
        },
      });

      let admin: { id: string; email: string; firstName: string } | null = null;
      if (input.admin) {
        const passwordRaw = randomToken(12);
        const passwordHash = await hashPassword(`${passwordRaw}A1!`);
        admin = await tx.user.create({
          data: {
            academyId: academy.id,
            email: input.admin.email,
            phone: input.admin.phone,
            firstName: input.admin.firstName,
            lastName: input.admin.lastName,
            displayName: `${input.admin.firstName} ${input.admin.lastName}`,
            passwordHash,
            role: UserRole.ACADEMY_ADMIN,
            status: UserStatus.PENDING_VERIFICATION,
          },
          select: { id: true, email: true, firstName: true },
        });

        const tokenRaw = randomToken(32);
        await tx.passwordReset.create({
          data: {
            userId: admin.id,
            tokenHash: sha256(tokenRaw),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        // Attach raw token so the caller can email it after commit.
        (admin as unknown as { _resetToken: string })._resetToken = tokenRaw;
      }

      return { academy, admin };
    });

    if (result.admin && input.admin?.sendInvite !== false) {
      const raw = (result.admin as unknown as { _resetToken: string })._resetToken;
      const resetUrl = `${this.config.get('APP_URL', { infer: true })}/auth/reset-password?token=${raw}`;
      await this.mailer
        .sendTemplate(result.admin.email, 'reset-password', {
          firstName: result.admin.firstName,
          email: result.admin.email,
          resetUrl,
          expiresInMinutes: 24 * 60,
          requestIp: null,
        })
        .catch((err) => this.logger.warn(`Admin invite mail failed: ${(err as Error).message}`));
    }

    await this.audit.fromRequest(req, 'CREATE', 'Academy', result.academy.id, { after: result.academy });
    return result.academy;
  }

  // ── List / detail ─────────────────────────────────────────────────────────
  async list(query: ListAcademiesQuery) {
    const where: Prisma.AcademyWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.discipline ? { discipline: query.discipline } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
              { contactEmail: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.AcademyOrderByWithRelationInput = query.sortBy
      ? ({ [query.sortBy]: query.sortDir } as Prisma.AcademyOrderByWithRelationInput)
      : { createdAt: 'desc' };

    const [total, rows] = await Promise.all([
      this.prisma.academy.count({ where }),
      this.prisma.academy.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          subscription: { select: { plan: true, status: true, seatLimit: true, currentPeriodEnd: true } },
          _count: { select: { students: true, users: true, branches: true } },
        },
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async findById(id: string) {
    const academy = await this.prisma.academy.findFirst({
      where: { id, deletedAt: null },
      include: {
        branches: { where: { deletedAt: null } },
        subscription: true,
        settings: true,
        _count: {
          select: { students: true, users: true, instructors: true, branches: true, events: true },
        },
      },
    });
    if (!academy) throw new NotFoundException('Academy not found');
    return academy;
  }

  async findBySlug(slug: string) {
    const academy = await this.prisma.academy.findFirst({
      where: { slug, deletedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        discipline: true,
        status: true,
        logoUrl: true,
        primaryColor: true,
        city: true,
        state: true,
      },
    });
    if (!academy) throw new NotFoundException('Academy not found');
    return academy;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async update(id: string, input: UpdateAcademyInput, req: AuthenticatedRequest) {
    const before = await this.findById(id);
    const after = await this.prisma.academy.update({
      where: { id },
      data: input as Prisma.AcademyUpdateInput,
    });
    await this.audit.fromRequest(req, 'UPDATE', 'Academy', id, { before, after });
    return after;
  }

  // ── Suspend / reactivate ─────────────────────────────────────────────────
  async setStatus(id: string, status: AcademyStatus, reason: string | undefined, req: AuthenticatedRequest) {
    const before = await this.findById(id);
    const after = await this.prisma.academy.update({
      where: { id },
      data: {
        status,
        metadata: reason
          ? ({ ...((before.metadata as object) ?? {}), lastStatusReason: reason, lastStatusAt: new Date().toISOString() } as Prisma.InputJsonValue)
          : undefined,
      },
    });
    await this.audit.fromRequest(req, 'UPDATE', 'Academy', id, {
      before: { status: before.status },
      after: { status: after.status, reason },
    });
    return after;
  }

  // ── Soft delete ──────────────────────────────────────────────────────────
  async softDelete(id: string, req: AuthenticatedRequest) {
    const before = await this.findById(id);
    if (before.status === AcademyStatus.ACTIVE) {
      throw new BadRequestException('Suspend the academy before deleting it');
    }
    await this.prisma.academy.update({
      where: { id },
      data: { deletedAt: new Date(), status: AcademyStatus.CANCELLED },
    });
    await this.audit.fromRequest(req, 'DELETE', 'Academy', id, { before });
    return { deleted: true };
  }

  // ── Subscription ─────────────────────────────────────────────────────────
  async getSubscription(academyId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { academyId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  async updateSubscription(academyId: string, input: UpdateSubscriptionInput, req: AuthenticatedRequest) {
    const before = await this.getSubscription(academyId);
    const after = await this.prisma.subscription.update({
      where: { academyId },
      data: input as Prisma.SubscriptionUpdateInput,
    });
    if (after.status === SubscriptionStatus.CANCELLED || after.status === SubscriptionStatus.EXPIRED) {
      await this.prisma.academy.update({
        where: { id: academyId },
        data: { status: AcademyStatus.EXPIRED },
      });
    }
    await this.audit.fromRequest(req, 'UPDATE', 'Subscription', after.id, { before, after });
    return after;
  }

  // ── Platform-level analytics (super admin) ───────────────────────────────
  async platformAnalytics() {
    const [byStatus, byPlan, revenueRows, monthly, totalStudents, totalUsers] = await Promise.all([
      this.prisma.academy.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.subscription.groupBy({
        by: ['plan'],
        _count: { _all: true },
        _sum: { pricePaise: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'CAPTURED' },
        _sum: { amountPaise: true },
      }),
      this.prisma.$queryRaw<Array<{ month: Date; captured_paise: bigint | null; count: bigint }>>`
        SELECT date_trunc('month', "createdAt") AS month,
               SUM(CASE WHEN status = 'CAPTURED' THEN "amountPaise" ELSE 0 END) AS captured_paise,
               COUNT(*) AS count
        FROM payments
        WHERE "createdAt" > NOW() - INTERVAL '12 months'
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      this.prisma.student.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ]);

    return {
      totals: {
        academies: byStatus.reduce((acc, r) => acc + r._count._all, 0),
        students: totalStudents,
        users: totalUsers,
        revenuePaise: revenueRows._sum.amountPaise ?? 0,
      },
      academiesByStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      subscriptionsByPlan: byPlan.map((r) => ({
        plan: r.plan,
        count: r._count._all,
        totalPricePaise: r._sum.pricePaise ?? 0,
      })),
      monthlyRevenue: monthly.map((r) => ({
        month: r.month,
        capturedPaise: Number(r.captured_paise ?? 0),
        count: Number(r.count),
      })),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private async ensureUniqueSlug(base: string): Promise<string> {
    const normalized = slugify(base);
    if (!normalized) throw new BadRequestException('Slug could not be derived from name');
    const existing = await this.prisma.academy.findUnique({ where: { slug: normalized }, select: { id: true } });
    if (!existing) return normalized;
    for (let i = 2; i < 1000; i++) {
      const candidate = `${normalized}-${i}`;
      const hit = await this.prisma.academy.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!hit) return candidate;
    }
    throw new ConflictException('Could not allocate a unique slug');
  }

  /**
   * Guard used by controllers to prevent an academy-scoped user from touching
   * an academy that isn't theirs. Super admins bypass.
   */
  assertOwnership(userAcademyId: string | null, role: UserRole, targetAcademyId: string): void {
    if (role === UserRole.SUPER_ADMIN) return;
    if (userAcademyId !== targetAcademyId) {
      throw new ForbiddenException('You cannot manage another academy');
    }
  }
}

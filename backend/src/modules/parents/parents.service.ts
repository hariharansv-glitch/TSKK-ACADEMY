import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { AuditLogService } from '@common/services/audit-log.service';
import { MailerService } from '@modules/mailer/mailer.service';
import { hashPassword } from '@common/utils/password.util';
import { randomToken, sha256 } from '@common/utils/hash.util';
import { paginate } from '@common/dto/paginated-response.dto';
import type { EnvVars } from '@config/env.validation';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';
import type {
  CreateParentInput,
  LinkChildInput,
  ListParentsQuery,
  UpdateParentInput,
} from './dto/parent.dto';

const PARENT_INCLUDE = {
  user: {
    select: {
      id: true, email: true, phone: true, status: true,
      emailVerified: true, lastLoginAt: true, avatarUrl: true,
    },
  },
  children: {
    include: {
      student: {
        select: {
          id: true, studentCode: true, firstName: true, lastName: true,
          photoUrl: true, currentBelt: true, status: true, dateOfBirth: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class ParentsService {
  private readonly logger = new Logger(ParentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────
  async create(academyId: string, input: CreateParentInput, req: AuthenticatedRequest) {
    const existingUser = input.createUserAccount
      ? await this.prisma.user.findUnique({ where: { email: input.email } })
      : null;
    if (existingUser) throw new ConflictException('A user account already exists for this email');

    const result = await this.prisma.$transaction(async (tx) => {
      let userId: string | null = null;
      let resetToken: string | null = null;

      if (input.createUserAccount) {
        const tempRaw = randomToken(24);
        const passwordHash = await hashPassword(`${tempRaw}A1!`);
        const created = await tx.user.create({
          data: {
            academyId,
            email: input.email,
            phone: input.phone,
            firstName: input.firstName,
            lastName: input.lastName,
            displayName: `${input.firstName} ${input.lastName}`,
            passwordHash,
            role: UserRole.PARENT,
            status: UserStatus.PENDING_VERIFICATION,
          },
        });
        userId = created.id;
        resetToken = randomToken(32);
        await tx.passwordReset.create({
          data: {
            userId: created.id,
            tokenHash: sha256(resetToken),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      const parent = await tx.parent.create({
        data: {
          academyId,
          userId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          alternatePhone: input.alternatePhone,
          occupation: input.occupation,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
        },
      });

      if (input.childStudentIds?.length) {
        for (const studentId of input.childStudentIds) {
          const student = await tx.student.findFirst({
            where: { id: studentId, academyId, deletedAt: null },
            select: { id: true },
          });
          if (!student) throw new NotFoundException(`Student ${studentId} not found in this academy`);
          await tx.parentStudent.upsert({
            where: { parentId_studentId: { parentId: parent.id, studentId } },
            create: {
              parentId: parent.id,
              studentId,
              relationship: 'Guardian',
              isPrimary: false,
              canPickup: true,
            },
            update: {},
          });
        }
      }

      return { parent, resetToken };
    });

    if (result.resetToken) {
      const resetUrl = `${this.config.get('APP_URL', { infer: true })}/auth/reset-password?token=${result.resetToken}`;
      await this.mailer
        .sendTemplate(input.email, 'reset-password', {
          firstName: input.firstName,
          email: input.email,
          resetUrl,
          expiresInMinutes: 24 * 60,
          requestIp: null,
        })
        .catch((err) => this.logger.warn(`Parent invite mail failed: ${(err as Error).message}`));
    }

    await this.audit.fromRequest(req, 'CREATE', 'Parent', result.parent.id, { after: result.parent });
    return this.findById(academyId, result.parent.id, null, /* skipVisibility */ true);
  }

  // ── List / detail ─────────────────────────────────────────────────────────
  async list(academyId: string, query: ListParentsQuery) {
    const where: Prisma.ParentWhereInput = {
      academyId,
      deletedAt: null,
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
    const orderBy: Prisma.ParentOrderByWithRelationInput = query.sortBy
      ? ({ [query.sortBy]: query.sortDir } as Prisma.ParentOrderByWithRelationInput)
      : { createdAt: 'desc' };

    const [total, rows] = await Promise.all([
      this.prisma.parent.count({ where }),
      this.prisma.parent.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          user: { select: { id: true, status: true, lastLoginAt: true } },
          _count: { select: { children: true } },
        },
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async findById(
    academyId: string,
    id: string,
    actor: AuthenticatedUser | null,
    skipVisibility = false,
  ) {
    const parent = await this.prisma.parent.findFirst({
      where: { id, academyId, deletedAt: null },
      include: PARENT_INCLUDE,
    });
    if (!parent) throw new NotFoundException('Parent not found');
    if (!skipVisibility && actor) this.assertVisibility(parent, actor);
    return parent;
  }

  // ── "Me" — parent portal ─────────────────────────────────────────────────
  async findMineByUser(academyId: string, userId: string) {
    const parent = await this.prisma.parent.findFirst({
      where: { academyId, userId, deletedAt: null },
      include: PARENT_INCLUDE,
    });
    if (!parent) throw new NotFoundException('No parent profile is linked to this account');
    return parent;
  }

  async myChildrenSummary(academyId: string, userId: string) {
    const parent = await this.findMineByUser(academyId, userId);
    const studentIds = parent.children.map((c) => c.student.id);
    if (studentIds.length === 0) return { parent, summary: [] };

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [attendance, pendingFees, certificateCounts] = await Promise.all([
      this.prisma.attendance.groupBy({
        by: ['studentId', 'status'],
        where: { studentId: { in: studentIds }, date: { gte: monthStart } },
        _count: { _all: true },
      }),
      this.prisma.feeInvoice.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
        _sum: { balancePaise: true },
        _count: { _all: true },
      }),
      this.prisma.certificate.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, revokedAt: null },
        _count: { _all: true },
      }),
    ]);

    const summary = parent.children.map((c) => {
      const attRows = attendance.filter((a) => a.studentId === c.student.id);
      const presentCount = attRows.filter((a) => a.status === 'PRESENT').reduce((s, r) => s + r._count._all, 0);
      const absentCount = attRows.filter((a) => a.status === 'ABSENT').reduce((s, r) => s + r._count._all, 0);
      const lateCount = attRows.filter((a) => a.status === 'LATE').reduce((s, r) => s + r._count._all, 0);
      const feeRow = pendingFees.find((f) => f.studentId === c.student.id);
      const certRow = certificateCounts.find((f) => f.studentId === c.student.id);
      return {
        student: c.student,
        relationship: c.relationship,
        isPrimary: c.isPrimary,
        currentMonth: { present: presentCount, absent: absentCount, late: lateCount },
        pendingFees: {
          invoiceCount: feeRow?._count._all ?? 0,
          balancePaise: feeRow?._sum.balancePaise ?? 0,
        },
        certificateCount: certRow?._count._all ?? 0,
      };
    });
    return { parent, summary };
  }

  // ── Update / delete ──────────────────────────────────────────────────────
  async update(
    academyId: string,
    id: string,
    input: UpdateParentInput,
    actor: AuthenticatedUser,
    req: AuthenticatedRequest,
  ) {
    const before = await this.findById(academyId, id, actor);
    const after = await this.prisma.parent.update({
      where: { id },
      data: input as Prisma.ParentUpdateInput,
    });
    await this.audit.fromRequest(req, 'UPDATE', 'Parent', id, { before, after });
    return this.findById(academyId, id, actor);
  }

  async remove(academyId: string, id: string, req: AuthenticatedRequest) {
    const before = await this.prisma.parent.findFirst({
      where: { id, academyId, deletedAt: null },
      include: { children: true, user: { select: { id: true } } },
    });
    if (!before) throw new NotFoundException('Parent not found');
    await this.prisma.$transaction([
      this.prisma.parentStudent.deleteMany({ where: { parentId: id } }),
      this.prisma.parent.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    ]);
    await this.audit.fromRequest(req, 'DELETE', 'Parent', id, { before });
    return { deleted: true };
  }

  // ── Child linkage ────────────────────────────────────────────────────────
  async linkChild(
    academyId: string,
    parentId: string,
    input: LinkChildInput,
    req: AuthenticatedRequest,
  ) {
    await this.assertBelongsToAcademy(academyId, parentId);
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, academyId, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found in this academy');

    try {
      const link = await this.prisma.$transaction(async (tx) => {
        if (input.isPrimary) {
          await tx.parentStudent.updateMany({
            where: { studentId: input.studentId, isPrimary: true },
            data: { isPrimary: false },
          });
        }
        return tx.parentStudent.create({
          data: {
            parentId,
            studentId: input.studentId,
            relationship: input.relationship,
            isPrimary: input.isPrimary,
            canPickup: input.canPickup,
          },
        });
      });
      await this.audit.fromRequest(req, 'CREATE', 'ParentStudent', link.id, { after: link });
      return link;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('This parent is already linked to that student');
      }
      throw err;
    }
  }

  async unlinkChild(academyId: string, parentId: string, studentId: string, req: AuthenticatedRequest) {
    await this.assertBelongsToAcademy(academyId, parentId);
    const link = await this.prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });
    if (!link) throw new NotFoundException('Link not found');
    await this.prisma.parentStudent.delete({ where: { id: link.id } });
    await this.audit.fromRequest(req, 'DELETE', 'ParentStudent', link.id, { before: link });
    return { unlinked: true };
  }

  // ── Guards ───────────────────────────────────────────────────────────────
  private assertVisibility(parent: { userId: string | null }, actor: AuthenticatedUser): void {
    if (actor.role === UserRole.PARENT && parent.userId && parent.userId !== actor.id) {
      throw new ForbiddenException('You cannot access another parent profile');
    }
  }

  private async assertBelongsToAcademy(academyId: string, parentId: string): Promise<void> {
    const parent = await this.prisma.parent.findFirst({
      where: { id: parentId, academyId, deletedAt: null },
      select: { id: true },
    });
    if (!parent) throw new NotFoundException('Parent not found in this academy');
  }
}

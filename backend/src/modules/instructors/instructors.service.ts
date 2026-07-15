import {
  ConflictException,
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
import { formatEntityCode } from '@common/utils/ids.util';
import { paginate } from '@common/dto/paginated-response.dto';
import type { EnvVars } from '@config/env.validation';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';
import type {
  CreateInstructorInput,
  ListInstructorsQuery,
  UpdateInstructorInput,
} from './dto/instructor.dto';

const SALARY_PERMISSION = 'instructor.viewSalary';

const PUBLIC_SELECT = {
  id: true, academyId: true, userId: true, employeeCode: true,
  firstName: true, lastName: true, email: true, phone: true,
  dateOfBirth: true, gender: true, photoUrl: true,
  currentBelt: true, yearsExperience: true, qualifications: true,
  specializations: true, bio: true, joinedAt: true, isActive: true,
  addressLine1: true, city: true, state: true, postalCode: true,
  createdAt: true, updatedAt: true,
} satisfies Prisma.InstructorSelect;

const SENSITIVE_FIELDS = {
  salaryPaise: true,
  bankName: true,
  bankAccountNumber: true,
  bankIfsc: true,
  panNumber: true,
  aadhaarNumber: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
} satisfies Prisma.InstructorSelect;

@Injectable()
export class InstructorsService {
  private readonly logger = new Logger(InstructorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────
  async create(academyId: string, input: CreateInstructorInput, req: AuthenticatedRequest) {
    if (input.createUserAccount) {
      const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
      if (existing) throw new ConflictException('A user account already exists for this email');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const settings = await tx.academySetting.findUnique({ where: { academyId } });
      const prefix = settings?.employeeCodePrefix ?? 'EMP';
      const count = await tx.instructor.count({ where: { academyId } });
      const employeeCode = formatEntityCode(prefix, count + 1, 4);

      let userId: string | null = null;
      let resetToken: string | null = null;
      if (input.createUserAccount) {
        const tempRaw = randomToken(24);
        const passwordHash = await hashPassword(`${tempRaw}A1!`);
        const user = await tx.user.create({
          data: {
            academyId,
            email: input.email,
            phone: input.phone,
            firstName: input.firstName,
            lastName: input.lastName,
            displayName: `${input.firstName} ${input.lastName}`,
            passwordHash,
            role: UserRole.INSTRUCTOR,
            status: UserStatus.PENDING_VERIFICATION,
          },
        });
        userId = user.id;
        resetToken = randomToken(32);
        await tx.passwordReset.create({
          data: {
            userId: user.id,
            tokenHash: sha256(resetToken),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      return {
        instructor: await tx.instructor.create({
          data: {
            academyId,
            userId,
            employeeCode,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone,
            dateOfBirth: input.dateOfBirth,
            gender: input.gender,
            currentBelt: input.currentBelt,
            yearsExperience: input.yearsExperience,
            qualifications: input.qualifications,
            specializations: input.specializations,
            bio: input.bio,
            joinedAt: input.joinedAt ?? new Date(),
            isActive: input.isActive,
            salaryPaise: input.salaryPaise ?? 0,
            bankName: input.bankName,
            bankAccountNumber: input.bankAccountNumber,
            bankIfsc: input.bankIfsc,
            panNumber: input.panNumber,
            aadhaarNumber: input.aadhaarNumber,
            emergencyContactName: input.emergencyContactName,
            emergencyContactPhone: input.emergencyContactPhone,
            addressLine1: input.addressLine1,
            city: input.city,
            state: input.state,
            postalCode: input.postalCode,
          },
        }),
        resetToken,
      };
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
        .catch((err) => this.logger.warn(`Instructor invite mail failed: ${(err as Error).message}`));
    }

    await this.audit.fromRequest(req, 'CREATE', 'Instructor', result.instructor.id, {
      after: { ...result.instructor, salaryPaise: undefined, bankAccountNumber: undefined },
    });
    return this.findById(academyId, result.instructor.id, /* actor */ null);
  }

  // ── List / detail ─────────────────────────────────────────────────────────
  async list(academyId: string, query: ListInstructorsQuery, actor: AuthenticatedUser) {
    const where: Prisma.InstructorWhereInput = {
      academyId,
      deletedAt: null,
      ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {}),
      ...(query.belt ? { currentBelt: query.belt } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { employeeCode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.InstructorOrderByWithRelationInput = query.sortBy
      ? ({ [query.sortBy]: query.sortDir } as Prisma.InstructorOrderByWithRelationInput)
      : { createdAt: 'desc' };
    const select = this.selectForActor(actor);

    const [total, rows] = await Promise.all([
      this.prisma.instructor.count({ where }),
      this.prisma.instructor.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          ...select,
          _count: { select: { classes: true, batches: true, examsEvaluated: true } },
        },
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async findById(academyId: string, id: string, actor: AuthenticatedUser | null) {
    const select = actor ? this.selectForActor(actor) : { ...PUBLIC_SELECT, ...SENSITIVE_FIELDS };
    const instructor = await this.prisma.instructor.findFirst({
      where: { id, academyId, deletedAt: null },
      select: {
        ...select,
        user: { select: { id: true, status: true, emailVerified: true, lastLoginAt: true } },
        classes: { select: { id: true, name: true, isActive: true } },
        batches: {
          where: { isActive: true },
          select: { id: true, name: true, startDate: true, endDate: true, scheduleJson: true, classId: true },
        },
        _count: { select: { classes: true, batches: true, examsEvaluated: true } },
      },
    });
    if (!instructor) throw new NotFoundException('Instructor not found');
    return instructor;
  }

  async findMineByUser(academyId: string, userId: string) {
    const instructor = await this.prisma.instructor.findFirst({
      where: { academyId, userId, deletedAt: null },
      select: {
        ...PUBLIC_SELECT,
        ...SENSITIVE_FIELDS,
        classes: { select: { id: true, name: true, isActive: true } },
        batches: {
          where: { isActive: true },
          select: { id: true, name: true, startDate: true, endDate: true, scheduleJson: true, classId: true },
        },
      },
    });
    if (!instructor) throw new NotFoundException('No instructor profile is linked to this account');
    return instructor;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async update(
    academyId: string,
    id: string,
    input: UpdateInstructorInput,
    actor: AuthenticatedUser,
    req: AuthenticatedRequest,
  ) {
    const canWriteSensitive = actor.permissions.includes(SALARY_PERMISSION);
    const sanitized: Prisma.InstructorUpdateInput = { ...(input as Prisma.InstructorUpdateInput) };
    if (!canWriteSensitive) {
      delete sanitized.salaryPaise;
      delete sanitized.bankName;
      delete sanitized.bankAccountNumber;
      delete sanitized.bankIfsc;
      delete sanitized.panNumber;
      delete sanitized.aadhaarNumber;
    }
    const before = await this.findById(academyId, id, actor);
    const after = await this.prisma.instructor.update({ where: { id }, data: sanitized });
    await this.audit.fromRequest(req, 'UPDATE', 'Instructor', id, {
      before: this.redactBeforeAudit(before as unknown as Record<string, unknown>),
      after: this.redactBeforeAudit(after as unknown as Record<string, unknown>),
    });
    return this.findById(academyId, id, actor);
  }

  async remove(academyId: string, id: string, req: AuthenticatedRequest) {
    const before = await this.prisma.instructor.findFirst({
      where: { id, academyId, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Instructor not found');
    await this.prisma.instructor.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.fromRequest(req, 'DELETE', 'Instructor', id, {
      before: this.redactBeforeAudit(before as unknown as Record<string, unknown>),
    });
    return { deleted: true };
  }

  // ── Schedule ─────────────────────────────────────────────────────────────
  async schedule(academyId: string, id: string) {
    const instructor = await this.prisma.instructor.findFirst({
      where: { id, academyId, deletedAt: null, isActive: true },
      select: {
        id: true, firstName: true, lastName: true,
        batches: {
          where: { isActive: true, endDate: null },
          select: {
            id: true, name: true, startDate: true, endDate: true,
            scheduleJson: true,
            class: { select: { id: true, name: true } },
            _count: { select: { students: true } },
          },
        },
      },
    });
    if (!instructor) throw new NotFoundException('Active instructor not found');
    return instructor;
  }

  // ── Performance ──────────────────────────────────────────────────────────
  async performance(academyId: string, id: string) {
    const instructor = await this.prisma.instructor.findFirst({
      where: { id, academyId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, currentBelt: true, yearsExperience: true },
    });
    if (!instructor) throw new NotFoundException('Instructor not found');

    const [batches, batchStudentCount, exams, attendanceMarked] = await Promise.all([
      this.prisma.batch.count({ where: { academyId, instructorId: id, isActive: true } }),
      this.prisma.batchStudent.count({
        where: { batch: { academyId, instructorId: id, isActive: true }, leftAt: null },
      }),
      this.prisma.beltExam.groupBy({
        by: ['result'],
        where: { academyId, evaluatorId: id },
        _count: { _all: true },
      }),
      this.prisma.attendance.count({
        where: {
          academyId,
          markedBy: { instructor: { id } },
          date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      instructor,
      activeBatches: batches,
      studentsTaught: batchStudentCount,
      beltExamsBreakdown: exams.map((e) => ({ result: e.result, count: e._count._all })),
      attendanceMarkedLast30Days: attendanceMarked,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private selectForActor(actor: AuthenticatedUser | null): Prisma.InstructorSelect {
    if (actor && actor.permissions.includes(SALARY_PERMISSION)) {
      return { ...PUBLIC_SELECT, ...SENSITIVE_FIELDS };
    }
    return PUBLIC_SELECT;
  }

  private redactBeforeAudit(payload: Record<string, unknown>): Record<string, unknown> {
    const clone = { ...payload };
    if (clone.bankAccountNumber) clone.bankAccountNumber = this.mask(String(clone.bankAccountNumber));
    if (clone.aadhaarNumber) clone.aadhaarNumber = this.mask(String(clone.aadhaarNumber));
    if (clone.panNumber) clone.panNumber = this.mask(String(clone.panNumber));
    return clone;
  }

  private mask(value: string): string {
    if (value.length <= 4) return '****';
    return value.slice(0, 2) + '*'.repeat(Math.max(0, value.length - 4)) + value.slice(-2);
  }
}

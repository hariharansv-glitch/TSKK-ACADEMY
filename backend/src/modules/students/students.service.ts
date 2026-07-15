import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, StudentStatus } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { AuditLogService } from '@common/services/audit-log.service';
import { StorageService } from '@common/storage/storage.service';
import { PdfService } from '@common/pdf/pdf.service';
import { paginate } from '@common/dto/paginated-response.dto';
import { formatEntityCode } from '@common/utils/ids.util';
import { buildStudentQrPayload, renderQrPng } from '@common/utils/qr.util';
import type { EnvVars } from '@config/env.validation';
import type { AuthenticatedRequest } from '@common/types/authenticated-request';
import type { CreateStudentInput } from './dto/create-student.dto';
import type { UpdateStudentInput } from './dto/update-student.dto';
import type { AssignBatchInput, HistoryEntryInput, ListStudentsQuery } from './dto/list-students.dto';
import * as path from 'path';

const STUDENT_INCLUDE = {
  branch: { select: { id: true, name: true, code: true } },
  parentLinks: {
    include: {
      parent: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      },
    },
  },
  batches: {
    include: {
      batch: {
        select: { id: true, name: true, classId: true, isActive: true },
      },
    },
  },
  _count: {
    select: {
      attendances: true,
      feeInvoices: true,
      payments: true,
      beltExams: true,
      certificates: true,
    },
  },
} as const;

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly storage: StorageService,
    private readonly pdf: PdfService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────
  async create(academyId: string, input: CreateStudentInput, req: AuthenticatedRequest) {
    if (input.branchId) await this.assertBranchInAcademy(academyId, input.branchId);
    if (input.parentId) await this.assertParentInAcademy(academyId, input.parentId);

    const student = await this.prisma.$transaction(async (tx) => {
      const settings = await tx.academySetting.findUnique({ where: { academyId } });
      const prefix = settings?.studentCodePrefix ?? 'STU';
      const count = await tx.student.count({ where: { academyId } });
      const studentCode = formatEntityCode(prefix, count + 1);

      const { payload, signature } = buildStudentQrPayload({
        secret: this.config.get('QR_HMAC_SECRET', { infer: true }),
        academyId,
        studentCode,
      });

      const created = await tx.student.create({
        data: {
          academyId,
          branchId: input.branchId,
          studentCode,
          firstName: input.firstName,
          lastName: input.lastName,
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
          bloodGroup: input.bloodGroup,
          qrCode: payload,
          qrSignature: signature,
          admissionDate: input.admissionDate ?? new Date(),
          status: input.status ?? StudentStatus.ACTIVE,
          currentBelt: input.currentBelt,
          currentBeltSince: input.currentBeltSince,
          email: input.email,
          phone: input.phone,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          state: input.state,
          country: input.country,
          postalCode: input.postalCode,
          schoolName: input.schoolName,
          schoolClass: input.schoolClass,
          hobbies: input.hobbies,
          languages: input.languages,
          medicalConditions: input.medicalConditions,
          allergies: input.allergies,
          medications: input.medications,
          bloodPressure: input.bloodPressure,
          heightCm: input.heightCm,
          weightKg: input.weightKg,
          emergencyContactName: input.emergencyContactName,
          emergencyContactPhone: input.emergencyContactPhone,
          emergencyContactRelation: input.emergencyContactRelation,
          guardianName: input.guardianName,
          guardianPhone: input.guardianPhone,
          guardianEmail: input.guardianEmail,
          guardianOccupation: input.guardianOccupation,
          notes: input.notes,
        },
      });

      if (input.parentId) {
        await tx.parentStudent.create({
          data: {
            parentId: input.parentId,
            studentId: created.id,
            relationship: 'Guardian',
            isPrimary: true,
            canPickup: true,
          },
        });
      }
      if (input.batchIds?.length) {
        for (const batchId of input.batchIds) {
          const batch = await tx.batch.findFirst({ where: { id: batchId, academyId } });
          if (!batch) throw new BadRequestException(`Batch ${batchId} not found in this academy`);
          await tx.batchStudent.create({ data: { batchId, studentId: created.id } });
        }
      }
      await tx.studentHistory.create({
        data: {
          studentId: created.id,
          academyId,
          eventType: 'ADMISSION',
          title: 'Student admitted',
          description: `Admission recorded (${studentCode})`,
          occurredAt: created.admissionDate,
          createdBy: req.user?.id,
        },
      });
      return created;
    });

    await this.audit.fromRequest(req, 'CREATE', 'Student', student.id, { after: student });
    return this.findById(academyId, student.id);
  }

  // ── List / detail / search ────────────────────────────────────────────────
  async list(academyId: string, query: ListStudentsQuery) {
    const where: Prisma.StudentWhereInput = {
      academyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.belt ? { currentBelt: query.belt } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.batchId ? { batches: { some: { batchId: query.batchId } } } : {}),
      ...(query.admittedFrom || query.admittedTo
        ? {
            admissionDate: {
              ...(query.admittedFrom ? { gte: query.admittedFrom } : {}),
              ...(query.admittedTo ? { lte: query.admittedTo } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { studentCode: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { guardianName: { contains: query.search, mode: 'insensitive' } },
              { guardianPhone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.StudentOrderByWithRelationInput = query.sortBy
      ? ({ [query.sortBy]: query.sortDir } as Prisma.StudentOrderByWithRelationInput)
      : { createdAt: 'desc' };

    const [total, rows] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          _count: { select: { attendances: true, feeInvoices: true } },
        },
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async findByUserId(academyId: string, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { academyId, userId, deletedAt: null },
      include: STUDENT_INCLUDE,
    });
    if (!student) throw new NotFoundException('Student profile not found');
    return student;
  }

  async findById(academyId: string, id: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, academyId, deletedAt: null },
      include: STUDENT_INCLUDE,
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async findByCode(academyId: string, code: string) {
    const student = await this.prisma.student.findFirst({
      where: { academyId, studentCode: code, deletedAt: null },
      include: STUDENT_INCLUDE,
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async update(academyId: string, id: string, input: UpdateStudentInput, req: AuthenticatedRequest) {
    const before = await this.findById(academyId, id);
    if (input.branchId) await this.assertBranchInAcademy(academyId, input.branchId);

    const after = await this.prisma.student.update({
      where: { id },
      data: input as Prisma.StudentUpdateInput,
    });

    if (input.currentBelt && input.currentBelt !== before.currentBelt) {
      await this.prisma.studentHistory.create({
        data: {
          studentId: id,
          academyId,
          eventType: 'BELT_CHANGE',
          title: `Belt updated to ${input.currentBelt}`,
          description: `Changed from ${before.currentBelt} to ${input.currentBelt}`,
          data: { from: before.currentBelt, to: input.currentBelt },
          createdBy: req.user?.id,
        },
      });
    }
    if (input.status && input.status !== before.status) {
      await this.prisma.studentHistory.create({
        data: {
          studentId: id,
          academyId,
          eventType: 'STATUS_CHANGE',
          title: `Status changed to ${input.status}`,
          data: { from: before.status, to: input.status },
          createdBy: req.user?.id,
        },
      });
    }

    await this.audit.fromRequest(req, 'UPDATE', 'Student', id, { before, after });
    return this.findById(academyId, id);
  }

  async remove(academyId: string, id: string, req: AuthenticatedRequest) {
    const before = await this.findById(academyId, id);
    await this.prisma.student.update({
      where: { id },
      data: { deletedAt: new Date(), status: StudentStatus.INACTIVE },
    });
    await this.audit.fromRequest(req, 'DELETE', 'Student', id, { before });
    return { deleted: true };
  }

  // ── Photo upload ──────────────────────────────────────────────────────────
  async uploadPhoto(
    academyId: string,
    id: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    req: AuthenticatedRequest,
  ) {
    const student = await this.findById(academyId, id);
    if (!/^image\/(jpe?g|png|webp|gif)$/i.test(file.mimetype)) {
      throw new BadRequestException('Photo must be a JPEG, PNG, WEBP or GIF image');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Photo must be 5 MB or smaller');
    }
    const upload = await this.storage.upload({
      bucket: 'photos',
      keyPrefix: `students/${academyId}/${student.id}`,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      metadata: { studentCode: student.studentCode },
    });
    const after = await this.prisma.student.update({
      where: { id },
      data: { photoUrl: upload.url },
    });
    await this.audit.fromRequest(req, 'UPDATE', 'Student', id, {
      before: { photoUrl: student.photoUrl },
      after: { photoUrl: after.photoUrl },
    });
    return { photoUrl: after.photoUrl };
  }

  // ── QR ────────────────────────────────────────────────────────────────────
  async getQrPng(academyId: string, id: string): Promise<Buffer> {
    const student = await this.findById(academyId, id);
    return renderQrPng(student.qrCode);
  }

  // ── History ───────────────────────────────────────────────────────────────
  async addHistory(academyId: string, id: string, input: HistoryEntryInput, req: AuthenticatedRequest) {
    await this.findById(academyId, id);
    return this.prisma.studentHistory.create({
      data: {
        studentId: id,
        academyId,
        eventType: input.eventType,
        title: input.title,
        description: input.description,
        data: input.data as Prisma.InputJsonValue | undefined,
        occurredAt: input.occurredAt ?? new Date(),
        createdBy: req.user?.id,
      },
    });
  }

  async listHistory(academyId: string, id: string) {
    await this.findById(academyId, id);
    return this.prisma.studentHistory.findMany({
      where: { studentId: id, academyId },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }

  // ── Batch assignment ──────────────────────────────────────────────────────
  async addToBatch(academyId: string, studentId: string, input: AssignBatchInput, req: AuthenticatedRequest) {
    const student = await this.findById(academyId, studentId);
    const batch = await this.prisma.batch.findFirst({
      where: { id: input.batchId, academyId, isActive: true },
    });
    if (!batch) throw new NotFoundException('Batch not found in this academy');
    try {
      const link = await this.prisma.batchStudent.create({
        data: { batchId: batch.id, studentId },
      });
      await this.audit.fromRequest(req, 'CREATE', 'BatchStudent', link.id, {
        after: { studentId: student.id, batchId: batch.id },
      });
      return link;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Student is already enrolled in this batch');
      }
      throw err;
    }
  }

  async removeFromBatch(academyId: string, studentId: string, batchId: string, req: AuthenticatedRequest) {
    await this.findById(academyId, studentId);
    const link = await this.prisma.batchStudent.findFirst({
      where: { studentId, batchId, batch: { academyId } },
    });
    if (!link) throw new NotFoundException('Batch enrolment not found');
    await this.prisma.batchStudent.update({
      where: { id: link.id },
      data: { leftAt: new Date() },
    });
    await this.audit.fromRequest(req, 'DELETE', 'BatchStudent', link.id, {
      before: { studentId, batchId },
    });
    return { removed: true };
  }

  // ── Exports ───────────────────────────────────────────────────────────────
  async exportCsv(academyId: string, query: ListStudentsQuery): Promise<string> {
    const students = await this.prisma.student.findMany({
      where: {
        academyId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.belt ? { currentBelt: query.belt } : {}),
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      orderBy: { studentCode: 'asc' },
      include: { branch: { select: { name: true, code: true } } },
    });

    const columns = [
      'studentCode', 'firstName', 'lastName', 'gender', 'dateOfBirth',
      'status', 'currentBelt', 'branch', 'phone', 'email',
      'guardianName', 'guardianPhone', 'admissionDate', 'city', 'state',
    ];

    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
      if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows = [columns.join(',')];
    for (const s of students) {
      rows.push([
        s.studentCode, s.firstName, s.lastName, s.gender, s.dateOfBirth,
        s.status, s.currentBelt, s.branch?.name ?? '', s.phone ?? '', s.email ?? '',
        s.guardianName ?? '', s.guardianPhone ?? '', s.admissionDate, s.city ?? '', s.state ?? '',
      ].map(escape).join(','));
    }
    return rows.join('\n');
  }

  async exportPdf(academyId: string, query: ListStudentsQuery): Promise<Buffer> {
    const [academy, students] = await Promise.all([
      this.prisma.academy.findUnique({
        where: { id: academyId },
        select: { name: true, city: true, state: true, primaryColor: true, logoUrl: true },
      }),
      this.prisma.student.findMany({
        where: {
          academyId,
          deletedAt: null,
          ...(query.status ? { status: query.status } : {}),
          ...(query.belt ? { currentBelt: query.belt } : {}),
          ...(query.branchId ? { branchId: query.branchId } : {}),
        },
        orderBy: { studentCode: 'asc' },
        include: { branch: { select: { name: true, code: true } } },
        take: 2000,
      }),
    ]);
    if (!academy) throw new NotFoundException('Academy not found');

    const templatePath = path.resolve(__dirname, 'templates', 'students-report.hbs');
    return this.pdf.renderTemplate({
      templatePath,
      context: {
        academyName: academy.name,
        academyLocation: [academy.city, academy.state].filter(Boolean).join(', '),
        academyLogoUrl: academy.logoUrl,
        primaryColor: academy.primaryColor ?? '#B91C1C',
        generatedAt: new Date().toLocaleString('en-IN'),
        totalCount: students.length,
        students: students.map((s, idx) => ({
          index: idx + 1,
          studentCode: s.studentCode,
          fullName: `${s.firstName} ${s.lastName}`,
          gender: s.gender,
          dob: s.dateOfBirth.toISOString().slice(0, 10),
          status: s.status,
          belt: s.currentBelt,
          branch: s.branch?.name ?? '—',
          phone: s.phone ?? s.guardianPhone ?? '—',
          admittedOn: s.admissionDate.toISOString().slice(0, 10),
        })),
      },
    });
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  private async assertBranchInAcademy(academyId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, academyId, deletedAt: null },
      select: { id: true },
    });
    if (!branch) throw new BadRequestException('Branch does not belong to this academy');
  }

  private async assertParentInAcademy(academyId: string, parentId: string): Promise<void> {
    const parent = await this.prisma.parent.findFirst({
      where: { id: parentId, academyId, deletedAt: null },
      select: { id: true },
    });
    if (!parent) throw new BadRequestException('Parent does not belong to this academy');
  }
}

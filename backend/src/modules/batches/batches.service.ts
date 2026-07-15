import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { AuditLogService } from '@common/services/audit-log.service';
import { paginate } from '@common/dto/paginated-response.dto';
import type { AuthenticatedRequest } from '@common/types/authenticated-request';

import type { CreateClassInput, ListClassesQuery, UpdateClassInput } from './dto/class.dto';
import type {
  CreateBatchInput,
  EnrollStudentInput,
  ListBatchesQuery,
  ScheduleSlot,
  UpdateBatchInput,
} from './dto/batch.dto';

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // ── Classes ────────────────────────────────────────────────────────────────
  async listClasses(academyId: string, q: ListClassesQuery) {
    const where: Prisma.ClassWhereInput = {
      academyId,
      ...(q.branchId ? { branchId: q.branchId } : {}),
      ...(q.isActive !== undefined ? { isActive: q.isActive } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { description: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.class.findMany({
        where,
        include: { instructor: { select: { id: true, firstName: true, lastName: true } }, branch: { select: { id: true, name: true } }, _count: { select: { batches: true } } },
        orderBy: { name: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.class.count({ where }),
    ]);
    return paginate(rows, q.page, q.pageSize, total);
  }

  async createClass(academyId: string, input: CreateClassInput, req: AuthenticatedRequest) {
    if (input.minAge && input.maxAge && input.minAge > input.maxAge) {
      throw new BadRequestException('minAge cannot be greater than maxAge');
    }
    const row = await this.prisma.class.create({ data: { academyId, ...input } });
    await this.audit.fromRequest(req, 'CREATE', 'Class', row.id, { after: row });
    return row;
  }

  async findClass(academyId: string, id: string) {
    const row = await this.prisma.class.findFirst({
      where: { academyId, id },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
        batches: { orderBy: { startDate: 'desc' }, take: 20 },
      },
    });
    if (!row) throw new NotFoundException('Class not found');
    return row;
  }

  async updateClass(academyId: string, id: string, input: UpdateClassInput, req: AuthenticatedRequest) {
    const before = await this.findClass(academyId, id);
    const row = await this.prisma.class.update({ where: { id }, data: input });
    await this.audit.fromRequest(req, 'UPDATE', 'Class', id, { before, after: row });
    return row;
  }

  async removeClass(academyId: string, id: string, req: AuthenticatedRequest) {
    const before = await this.findClass(academyId, id);
    const activeBatches = await this.prisma.batch.count({ where: { classId: id, isActive: true } });
    if (activeBatches > 0) {
      throw new ConflictException('Deactivate active batches before deleting this class');
    }
    await this.prisma.class.delete({ where: { id } });
    await this.audit.fromRequest(req, 'DELETE', 'Class', id, { before });
    return { deleted: true };
  }

  // ── Batches ────────────────────────────────────────────────────────────────
  async listBatches(academyId: string, q: ListBatchesQuery) {
    const where: Prisma.BatchWhereInput = {
      academyId,
      ...(q.classId ? { classId: q.classId } : {}),
      ...(q.branchId ? { branchId: q.branchId } : {}),
      ...(q.instructorId ? { instructorId: q.instructorId } : {}),
      ...(q.isActive !== undefined ? { isActive: q.isActive } : {}),
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.batch.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          instructor: { select: { id: true, firstName: true, lastName: true } },
          branch: { select: { id: true, name: true } },
          _count: { select: { students: true } },
        },
        orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.batch.count({ where }),
    ]);
    return paginate(rows, q.page, q.pageSize, total);
  }

  async createBatch(academyId: string, input: CreateBatchInput, req: AuthenticatedRequest) {
    await this.assertClass(academyId, input.classId);
    if (input.instructorId) await this.assertInstructor(academyId, input.instructorId);
    if (input.endDate && input.endDate <= input.startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }
    this.assertSchedule(input.schedule);
    const { schedule, ...rest } = input;
    const row = await this.prisma.batch.create({
      data: { academyId, scheduleJson: schedule as unknown as Prisma.InputJsonValue, ...rest },
    });
    await this.audit.fromRequest(req, 'CREATE', 'Batch', row.id, { after: row });
    return row;
  }

  async findBatch(academyId: string, id: string) {
    const row = await this.prisma.batch.findFirst({
      where: { academyId, id },
      include: {
        class: { select: { id: true, name: true, minBelt: true, maxBelt: true } },
        instructor: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
        students: {
          where: { leftAt: null },
          include: {
            student: {
              select: { id: true, firstName: true, lastName: true, studentCode: true, currentBelt: true, photoUrl: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Batch not found');
    return row;
  }

  async updateBatch(academyId: string, id: string, input: UpdateBatchInput, req: AuthenticatedRequest) {
    const before = await this.findBatch(academyId, id);
    if (input.classId) await this.assertClass(academyId, input.classId);
    if (input.instructorId) await this.assertInstructor(academyId, input.instructorId);
    if (input.schedule) this.assertSchedule(input.schedule);
    const { schedule, ...rest } = input;
    const row = await this.prisma.batch.update({
      where: { id },
      data: {
        ...rest,
        ...(schedule
          ? { scheduleJson: schedule as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
    await this.audit.fromRequest(req, 'UPDATE', 'Batch', id, { before, after: row });
    return row;
  }

  async removeBatch(academyId: string, id: string, req: AuthenticatedRequest) {
    const before = await this.findBatch(academyId, id);
    await this.prisma.batch.delete({ where: { id } });
    await this.audit.fromRequest(req, 'DELETE', 'Batch', id, { before });
    return { deleted: true };
  }

  async enrollStudent(
    academyId: string,
    batchId: string,
    input: EnrollStudentInput,
    req: AuthenticatedRequest,
  ) {
    const batch = await this.findBatch(academyId, batchId);
    const activeCount = batch.students.length;
    if (activeCount >= batch.capacity) {
      throw new ConflictException('Batch is at capacity');
    }
    await this.assertStudent(academyId, input.studentId);
    const existing = await this.prisma.batchStudent.findFirst({
      where: { batchId, studentId: input.studentId, leftAt: null },
    });
    if (existing) throw new ConflictException('Student is already enrolled in this batch');

    const enrollment = await this.prisma.batchStudent.create({
      data: { batchId, studentId: input.studentId },
    });
    await this.audit.fromRequest(req, 'CREATE', 'BatchStudent', enrollment.id, { after: enrollment });
    return enrollment;
  }

  async removeStudent(academyId: string, batchId: string, studentId: string, req: AuthenticatedRequest) {
    await this.findBatch(academyId, batchId);
    const enrollment = await this.prisma.batchStudent.findFirst({
      where: { batchId, studentId, leftAt: null },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    const updated = await this.prisma.batchStudent.update({
      where: { id: enrollment.id },
      data: { leftAt: new Date() },
    });
    await this.audit.fromRequest(req, 'UPDATE', 'BatchStudent', enrollment.id, {
      before: enrollment,
      after: updated,
    });
    return { removed: true };
  }

  // ── Internal helpers ───────────────────────────────────────────────────────
  private assertSchedule(slots: ScheduleSlot[]) {
    for (const s of slots) {
      if (s.end <= s.start) {
        throw new BadRequestException(`Schedule end (${s.end}) must be after start (${s.start})`);
      }
    }
  }

  private async assertClass(academyId: string, classId: string) {
    const row = await this.prisma.class.findFirst({ where: { id: classId, academyId } });
    if (!row) throw new NotFoundException('Class not found');
  }

  private async assertInstructor(academyId: string, instructorId: string) {
    const row = await this.prisma.instructor.findFirst({
      where: { id: instructorId, academyId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Instructor not found');
  }

  private async assertStudent(academyId: string, studentId: string) {
    const row = await this.prisma.student.findFirst({
      where: { id: studentId, academyId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Student not found');
  }
}

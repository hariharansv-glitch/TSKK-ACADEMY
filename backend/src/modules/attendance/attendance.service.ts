import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttendanceMethod, AttendanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { AuditLogService } from '@common/services/audit-log.service';
import { paginate } from '@common/dto/paginated-response.dto';
import { verifyStudentQrPayload } from '@common/utils/qr.util';
import type { EnvVars } from '@config/env.validation';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';
import type {
  BulkMarkInput,
  CreateHolidayInput,
  ListAttendanceQuery,
  MarkAttendanceInput,
  ScanQrInput,
} from './dto/attendance.dto';

function truncateToDate(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  // ── Scan a student QR code ────────────────────────────────────────────────
  async scan(academyId: string, input: ScanQrInput, req: AuthenticatedRequest) {
    const verified = verifyStudentQrPayload(input.payload, this.config.get('QR_HMAC_SECRET', { infer: true }));
    if (!verified.valid) throw new BadRequestException('QR signature is invalid or corrupted');
    if (verified.academyId !== academyId) {
      throw new ForbiddenException('QR belongs to a different academy');
    }
    const student = await this.prisma.student.findFirst({
      where: { academyId, studentCode: verified.studentCode, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (student.status !== 'ACTIVE') {
      throw new ForbiddenException(`Cannot check in a ${student.status} student`);
    }

    const settings = await this.prisma.academySetting.findUnique({ where: { academyId } });
    const lateAfterMinutes = settings?.attendanceLateAfterMinutes ?? 10;

    const now = input.checkInAt ?? new Date();
    const date = truncateToDate(now);
    const status = this.computeQrStatus(now, lateAfterMinutes);

    const existing = await this.prisma.attendance.findFirst({
      where: { studentId: student.id, date, batchId: input.batchId ?? null },
    });
    if (existing) {
      throw new ConflictException('Attendance for this student on this date is already recorded');
    }

    const row = await this.prisma.attendance.create({
      data: {
        academyId,
        studentId: student.id,
        branchId: student.branchId,
        batchId: input.batchId,
        date,
        status,
        method: AttendanceMethod.QR,
        checkInAt: now,
        minutesLate: status === AttendanceStatus.LATE ? this.minutesPastReference(now) : null,
        markedById: req.user?.id,
        ipAddress: (req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip) ?? undefined,
      },
    });
    await this.audit.fromRequest(req, 'CREATE', 'Attendance', row.id, { after: row });
    return { attendance: row, student: { id: student.id, code: student.studentCode, firstName: student.firstName, lastName: student.lastName } };
  }

  // ── Manual single mark ────────────────────────────────────────────────────
  async mark(academyId: string, input: MarkAttendanceInput, req: AuthenticatedRequest) {
    await this.assertStudentInAcademy(academyId, input.studentId);
    if (input.batchId) await this.assertBatchInAcademy(academyId, input.batchId);
    const date = truncateToDate(input.date);
    try {
      const row = await this.prisma.attendance.create({
        data: {
          academyId,
          studentId: input.studentId,
          batchId: input.batchId,
          date,
          status: input.status,
          method: input.method ?? AttendanceMethod.MANUAL,
          checkInAt: input.checkInAt,
          checkOutAt: input.checkOutAt,
          notes: input.notes,
          markedById: req.user?.id,
        },
      });
      await this.audit.fromRequest(req, 'CREATE', 'Attendance', row.id, { after: row });
      return row;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Attendance is already recorded for this student, date and batch');
      }
      throw err;
    }
  }

  // ── Bulk mark for a batch ────────────────────────────────────────────────
  async bulkMark(academyId: string, input: BulkMarkInput, req: AuthenticatedRequest) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: input.batchId, academyId, isActive: true },
    });
    if (!batch) throw new NotFoundException('Active batch not found');

    const date = truncateToDate(input.date);
    const rows = await this.prisma.$transaction(
      input.entries.map((e) =>
        this.prisma.attendance.upsert({
          where: {
            studentId_date_batchId: { studentId: e.studentId, date, batchId: input.batchId },
          },
          create: {
            academyId,
            studentId: e.studentId,
            batchId: input.batchId,
            date,
            status: e.status,
            method: input.method ?? AttendanceMethod.MANUAL,
            notes: e.notes,
            markedById: req.user?.id,
          },
          update: { status: e.status, notes: e.notes, markedById: req.user?.id },
        }),
      ),
    );
    await this.audit.fromRequest(req, 'CREATE', 'Attendance', input.batchId, {
      after: { batchId: input.batchId, date, count: rows.length },
    });
    return { recorded: rows.length, rows };
  }

  // ── Query / list ─────────────────────────────────────────────────────────
  async list(academyId: string, query: ListAttendanceQuery) {
    const where: Prisma.AttendanceWhereInput = {
      academyId,
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.batchId ? { batchId: query.batchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: truncateToDate(query.from) } : {}),
              ...(query.to ? { lte: truncateToDate(query.to) } : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.findMany({
        where,
        orderBy: [{ date: 'desc' }, { checkInAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          student: { select: { id: true, studentCode: true, firstName: true, lastName: true, photoUrl: true } },
          batch: { select: { id: true, name: true } },
        },
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  // ── Student summary (parent portal / student portal) ──────────────────────
  async studentSummary(academyId: string, studentId: string, from?: Date, to?: Date) {
    await this.assertStudentInAcademy(academyId, studentId);
    const now = new Date();
    const start = from ? truncateToDate(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = to ? truncateToDate(to) : now;

    const groups = await this.prisma.attendance.groupBy({
      by: ['status'],
      where: { academyId, studentId, date: { gte: start, lte: end } },
      _count: { _all: true },
    });
    const totalWorkingDays = this.countWorkingDays(start, end);
    const totals: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, HOLIDAY: 0, LEAVE: 0 };
    for (const g of groups) totals[g.status] = g._count._all;
    const present = totals.PRESENT + totals.LATE;
    const percent = totalWorkingDays === 0 ? 0 : Math.round((present / totalWorkingDays) * 1000) / 10;

    return {
      studentId,
      from: start,
      to: end,
      workingDays: totalWorkingDays,
      totals,
      attendancePercent: percent,
    };
  }

  // ── Reports ──────────────────────────────────────────────────────────────
  async batchDailyReport(academyId: string, batchId: string, date: Date) {
    await this.assertBatchInAcademy(academyId, batchId);
    const day = truncateToDate(date);
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        students: {
          where: { leftAt: null },
          include: {
            student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    const attendances = await this.prisma.attendance.findMany({
      where: { academyId, batchId, date: day },
      select: { studentId: true, status: true, checkInAt: true, method: true },
    });
    const byStudent = new Map(attendances.map((a) => [a.studentId, a]));
    const rows = batch.students.map((bs) => ({
      student: bs.student,
      status: byStudent.get(bs.student.id)?.status ?? null,
      checkInAt: byStudent.get(bs.student.id)?.checkInAt ?? null,
      method: byStudent.get(bs.student.id)?.method ?? null,
    }));
    return { batch: { id: batch.id, name: batch.name }, date: day, rows };
  }

  // ── Exports ──────────────────────────────────────────────────────────────
  async exportCsv(academyId: string, query: ListAttendanceQuery): Promise<string> {
    const rows = await this.prisma.attendance.findMany({
      where: {
        academyId,
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.batchId ? { batchId: query.batchId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.from || query.to
          ? {
              date: {
                ...(query.from ? { gte: truncateToDate(query.from) } : {}),
                ...(query.to ? { lte: truncateToDate(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ date: 'desc' }, { studentId: 'asc' }],
      include: {
        student: { select: { studentCode: true, firstName: true, lastName: true } },
        batch: { select: { name: true } },
      },
    });
    const cols = ['date', 'studentCode', 'firstName', 'lastName', 'batch', 'status', 'method', 'checkInAt', 'minutesLate', 'notes'];
    const esc = (v: unknown) => {
      if (v === null || v === undefined) return '';
      const s = v instanceof Date ? v.toISOString() : String(v);
      return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const out = [cols.join(',')];
    for (const r of rows) {
      out.push([
        r.date.toISOString().slice(0, 10),
        r.student.studentCode,
        r.student.firstName,
        r.student.lastName,
        r.batch?.name ?? '',
        r.status,
        r.method,
        r.checkInAt ?? '',
        r.minutesLate ?? '',
        r.notes ?? '',
      ].map(esc).join(','));
    }
    return out.join('\n');
  }

  // ── Holidays ─────────────────────────────────────────────────────────────
  async listHolidays(academyId: string, year?: number) {
    const y = year ?? new Date().getFullYear();
    return this.prisma.holiday.findMany({
      where: {
        academyId,
        OR: [
          { date: { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31, 23, 59, 59) } },
          { isRecurring: true },
        ],
      },
      orderBy: { date: 'asc' },
    });
  }

  async createHoliday(academyId: string, input: CreateHolidayInput, req: AuthenticatedRequest) {
    try {
      const row = await this.prisma.holiday.create({
        data: {
          academyId,
          name: input.name,
          date: input.date,
          isRecurring: input.isRecurring,
          description: input.description,
        },
      });
      await this.audit.fromRequest(req, 'CREATE', 'Holiday', row.id, { after: row });
      return row;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A holiday with this name and date already exists');
      }
      throw err;
    }
  }

  async removeHoliday(academyId: string, id: string, req: AuthenticatedRequest) {
    const row = await this.prisma.holiday.findFirst({ where: { id, academyId } });
    if (!row) throw new NotFoundException('Holiday not found');
    await this.prisma.holiday.delete({ where: { id } });
    await this.audit.fromRequest(req, 'DELETE', 'Holiday', id, { before: row });
    return { deleted: true };
  }

  // ── Delete an attendance record ──────────────────────────────────────────
  async remove(academyId: string, id: string, req: AuthenticatedRequest) {
    const row = await this.prisma.attendance.findFirst({ where: { id, academyId } });
    if (!row) throw new NotFoundException('Attendance not found');
    await this.prisma.attendance.delete({ where: { id } });
    await this.audit.fromRequest(req, 'DELETE', 'Attendance', id, { before: row });
    return { deleted: true };
  }

  // ── Access helpers ────────────────────────────────────────────────────────
  async assertParentCanReadStudent(academyId: string, actor: AuthenticatedUser, studentId: string) {
    if (actor.role !== 'PARENT') return;
    const link = await this.prisma.parentStudent.findFirst({
      where: {
        studentId,
        parent: { userId: actor.id, academyId },
      },
    });
    if (!link) throw new ForbiddenException('You may only view attendance for your linked children');
  }

  // ── Internal helpers ─────────────────────────────────────────────────────
  private computeQrStatus(now: Date, lateAfterMinutes: number): AttendanceStatus {
    const reference = new Date(now);
    reference.setHours(reference.getHours(), 0, 0, 0);
    const diffMin = Math.round((now.getTime() - reference.getTime()) / 60_000);
    return diffMin > lateAfterMinutes ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
  }

  private minutesPastReference(now: Date): number {
    const reference = new Date(now);
    reference.setHours(reference.getHours(), 0, 0, 0);
    return Math.max(0, Math.round((now.getTime() - reference.getTime()) / 60_000));
  }

  private countWorkingDays(start: Date, end: Date): number {
    let d = new Date(start);
    let count = 0;
    while (d <= end) {
      const day = d.getUTCDay();
      if (day !== 0) count++;
      d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    }
    return count;
  }

  private async assertStudentInAcademy(academyId: string, studentId: string): Promise<void> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, academyId, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found in this academy');
  }

  private async assertBatchInAcademy(academyId: string, batchId: string): Promise<void> {
    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, academyId },
      select: { id: true },
    });
    if (!batch) throw new NotFoundException('Batch not found in this academy');
  }
}

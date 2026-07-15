import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BeltLevel, CertificateType, ExamResult, Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { AuditLogService } from '@common/services/audit-log.service';
import { paginate } from '@common/dto/paginated-response.dto';
import { CertificatesService } from '@modules/certificates/certificates.service';
import type { AuthenticatedRequest } from '@common/types/authenticated-request';
import type { EnvVars } from '@config/env.validation';
import type { GradeBeltExamInput, ListBeltExamsQuery, ScheduleBeltExamInput } from './dto/belt.dto';

const BELT_ORDER: BeltLevel[] = [
  BeltLevel.WHITE,
  BeltLevel.YELLOW,
  BeltLevel.ORANGE,
  BeltLevel.GREEN,
  BeltLevel.BLUE,
  BeltLevel.PURPLE,
  BeltLevel.BROWN,
  BeltLevel.RED,
  BeltLevel.BLACK,
];

@Injectable()
export class BeltsService {
  private readonly logger = new Logger(BeltsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly certificates: CertificatesService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  async schedule(academyId: string, input: ScheduleBeltExamInput, req: AuthenticatedRequest) {
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, academyId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');
    this.assertBeltProgression(input.fromBelt, input.toBelt);

    if (input.evaluatorId) {
      const evaluator = await this.prisma.instructor.findFirst({
        where: { id: input.evaluatorId, academyId, deletedAt: null },
      });
      if (!evaluator) throw new NotFoundException('Evaluator (instructor) not found');
    }

    const exam = await this.prisma.beltExam.create({
      data: {
        academyId,
        studentId: input.studentId,
        evaluatorId: input.evaluatorId,
        fromBelt: input.fromBelt,
        toBelt: input.toBelt,
        examDate: input.examDate,
        location: input.location,
        maxMarks: input.maxMarks ?? 100,
        remarks: input.remarks,
        result: ExamResult.PENDING,
      },
    });
    await this.audit.fromRequest(req, 'CREATE', 'BeltExam', exam.id, { after: exam });
    return exam;
  }

  async grade(academyId: string, examId: string, input: GradeBeltExamInput, req: AuthenticatedRequest) {
    const before = await this.prisma.beltExam.findFirst({
      where: { id: examId, academyId },
      include: { student: true },
    });
    if (!before) throw new NotFoundException('Belt exam not found');
    if (before.result === ExamResult.PASSED || before.result === ExamResult.FAILED) {
      throw new BadRequestException('Belt exam has already been graded');
    }

    const totalMarks =
      input.totalMarks ??
      (input.technicalMarks ?? 0) + (input.physicalMarks ?? 0) + (input.disciplineMarks ?? 0);

    const graded = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.beltExam.update({
        where: { id: examId },
        data: {
          technicalMarks: input.technicalMarks,
          physicalMarks: input.physicalMarks,
          disciplineMarks: input.disciplineMarks,
          totalMarks,
          result: input.result,
          remarks: input.remarks,
        },
        include: { student: true, evaluator: true },
      });

      if (input.result === ExamResult.PASSED) {
        await tx.student.update({
          where: { id: before.studentId },
          data: { currentBelt: before.toBelt, lastBeltDate: new Date() },
        });
        await tx.studentHistory.create({
          data: {
            studentId: before.studentId,
            type: 'BELT_PROMOTION',
            title: `Promoted to ${before.toBelt} belt`,
            description: `Passed belt exam #${examId}`,
            metadata: { fromBelt: before.fromBelt, toBelt: before.toBelt, examId },
            createdById: req.user?.id,
          },
        });
      }
      return updated;
    });

    if (input.result === ExamResult.PASSED && (input.issueCertificate ?? true)) {
      try {
        const cert = await this.certificates.issueForBeltExam(academyId, graded.id, req);
        await this.prisma.beltExam.update({
          where: { id: graded.id },
          data: { certificateId: cert.id },
        });
        (graded as unknown as { certificateId: string | null }).certificateId = cert.id;
      } catch (err) {
        this.logger.error(`Failed to auto-issue certificate for exam ${graded.id}: ${(err as Error).message}`);
      }
    }

    await this.audit.fromRequest(req, 'UPDATE', 'BeltExam', examId, { before, after: graded });
    return graded;
  }

  async list(academyId: string, query: ListBeltExamsQuery) {
    const where: Prisma.BeltExamWhereInput = {
      academyId,
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.result ? { result: query.result } : {}),
      ...(query.fromDate || query.toDate
        ? {
            examDate: {
              ...(query.fromDate ? { gte: query.fromDate } : {}),
              ...(query.toDate ? { lte: query.toDate } : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.beltExam.count({ where }),
      this.prisma.beltExam.findMany({
        where,
        orderBy: { examDate: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
          evaluator: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
          certificate: { select: { id: true, certificateNumber: true, verificationCode: true } },
        },
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async findOne(academyId: string, id: string) {
    const exam = await this.prisma.beltExam.findFirst({
      where: { id, academyId },
      include: {
        student: true,
        evaluator: true,
        certificate: true,
      },
    });
    if (!exam) throw new NotFoundException('Belt exam not found');
    return exam;
  }

  async remove(academyId: string, id: string, req: AuthenticatedRequest) {
    const before = await this.prisma.beltExam.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Belt exam not found');
    if (before.result !== ExamResult.PENDING) {
      throw new BadRequestException('Only pending exams can be deleted');
    }
    await this.prisma.beltExam.delete({ where: { id } });
    await this.audit.fromRequest(req, 'DELETE', 'BeltExam', id, { before });
    return { deleted: true };
  }

  private assertBeltProgression(from: BeltLevel, to: BeltLevel): void {
    const fromIdx = BELT_ORDER.indexOf(from);
    const toIdx = BELT_ORDER.indexOf(to);
    if (fromIdx < 0 || toIdx < 0) throw new BadRequestException('Invalid belt level');
    if (toIdx <= fromIdx) throw new BadRequestException('Target belt must be higher than the current belt');
  }
}

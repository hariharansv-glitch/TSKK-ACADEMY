import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BeltLevel, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { AuditLogService } from '@common/services/audit-log.service';
import { paginate } from '@common/dto/paginated-response.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';
import type {
  CreateAssignmentInput,
  CreateDocumentInput,
  CreateVideoInput,
  GradeSubmissionInput,
  ListDocumentsQuery,
  ListVideosQuery,
  SubmitAssignmentInput,
  UpdateDocumentInput,
  UpdateVideoInput,
} from './dto/learning.dto';

const BELT_ORDER: BeltLevel[] = [
  BeltLevel.WHITE,
  BeltLevel.YELLOW,
  BeltLevel.ORANGE,
  BeltLevel.GREEN,
  BeltLevel.BLUE,
  BeltLevel.PURPLE,
  BeltLevel.BROWN,
  BeltLevel.RED,
  BeltLevel.BLACK_1,
  BeltLevel.BLACK_2,
  BeltLevel.BLACK_3,
  BeltLevel.BLACK_4,
  BeltLevel.BLACK_5,
];

const STAFF_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ACADEMY_ADMIN,
  UserRole.INSTRUCTOR,
  UserRole.RECEPTIONIST,
];

@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // ── Belt-gating helper for students ──────────────────────────────────────
  private async currentBeltForActor(academyId: string, actor: AuthenticatedUser): Promise<BeltLevel | null> {
    if (actor.role !== UserRole.STUDENT) return null;
    const student = await this.prisma.student.findFirst({
      where: { academyId, userId: actor.id },
      select: { currentBelt: true },
    });
    return student?.currentBelt ?? BeltLevel.WHITE;
  }

  private beltAtLeast(actorBelt: BeltLevel | null, requiredBelt: BeltLevel): boolean {
    if (!actorBelt) return true;
    return BELT_ORDER.indexOf(actorBelt) >= BELT_ORDER.indexOf(requiredBelt);
  }

  // ── Videos ────────────────────────────────────────────────────────────────
  async createVideo(academyId: string, input: CreateVideoInput, req: AuthenticatedRequest) {
    if (input.instructorId) {
      const inst = await this.prisma.instructor.findFirst({
        where: { id: input.instructorId, academyId, deletedAt: null },
      });
      if (!inst) throw new NotFoundException('Instructor not found');
    }
    const video = await this.prisma.video.create({
      data: {
        academyId,
        instructorId: input.instructorId,
        title: input.title,
        description: input.description,
        url: input.url,
        thumbnailUrl: input.thumbnailUrl,
        durationSeconds: input.durationSeconds,
        minBelt: input.minBelt ?? BeltLevel.WHITE,
        category: input.category,
        tags: input.tags ?? [],
        isPublished: input.isPublished ?? false,
        publishedAt: input.isPublished ? new Date() : null,
      },
    });
    await this.audit.fromRequest(req, 'CREATE', 'Video', video.id, { after: video });
    return video;
  }

  async listVideos(academyId: string, actor: AuthenticatedUser, query: ListVideosQuery) {
    const isStaff = STAFF_ROLES.includes(actor.role);
    const actorBelt = await this.currentBeltForActor(academyId, actor);
    const allowedBelts = actorBelt
      ? BELT_ORDER.slice(0, BELT_ORDER.indexOf(actorBelt) + 1)
      : BELT_ORDER;
    const where: Prisma.VideoWhereInput = {
      academyId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.instructorId ? { instructorId: query.instructorId } : {}),
      ...(query.minBelt ? { minBelt: query.minBelt } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { tags: { has: query.search } },
            ],
          }
        : {}),
      ...(!isStaff || query.publishedOnly ? { isPublished: true } : {}),
      ...(!isStaff ? { minBelt: { in: allowedBelts } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.video.count({ where }),
      this.prisma.video.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          instructor: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async findVideo(academyId: string, id: string, actor: AuthenticatedUser) {
    const video = await this.prisma.video.findFirst({
      where: { id, academyId },
      include: { instructor: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!video) throw new NotFoundException('Video not found');
    if (actor.role === UserRole.STUDENT) {
      if (!video.isPublished) throw new NotFoundException('Video not found');
      const belt = await this.currentBeltForActor(academyId, actor);
      if (!this.beltAtLeast(belt, video.minBelt)) {
        throw new ForbiddenException(`This video requires ${video.minBelt} belt or above`);
      }
    }
    await this.prisma.video.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    return video;
  }

  async updateVideo(academyId: string, id: string, input: UpdateVideoInput, req: AuthenticatedRequest) {
    const before = await this.prisma.video.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Video not found');
    const after = await this.prisma.video.update({
      where: { id },
      data: {
        ...input,
        publishedAt:
          input.isPublished && !before.isPublished ? new Date() : input.isPublished === false ? null : before.publishedAt,
      },
    });
    await this.audit.fromRequest(req, 'UPDATE', 'Video', id, { before, after });
    return after;
  }

  async removeVideo(academyId: string, id: string, req: AuthenticatedRequest) {
    const before = await this.prisma.video.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Video not found');
    await this.prisma.video.delete({ where: { id } });
    await this.audit.fromRequest(req, 'DELETE', 'Video', id, { before });
    return { deleted: true };
  }

  // ── Documents ─────────────────────────────────────────────────────────────
  async createDocument(academyId: string, input: CreateDocumentInput, req: AuthenticatedRequest) {
    const doc = await this.prisma.document.create({
      data: { academyId, ...input, minBelt: input.minBelt ?? BeltLevel.WHITE },
    });
    await this.audit.fromRequest(req, 'CREATE', 'Document', doc.id, { after: doc });
    return doc;
  }

  async listDocuments(academyId: string, actor: AuthenticatedUser, query: ListDocumentsQuery) {
    const isStaff = STAFF_ROLES.includes(actor.role);
    const actorBelt = await this.currentBeltForActor(academyId, actor);
    const allowedBelts = actorBelt
      ? BELT_ORDER.slice(0, BELT_ORDER.indexOf(actorBelt) + 1)
      : BELT_ORDER;
    const where: Prisma.DocumentWhereInput = {
      academyId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.minBelt ? { minBelt: query.minBelt } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(!isStaff || query.publishedOnly ? { isPublished: true } : {}),
      ...(!isStaff ? { minBelt: { in: allowedBelts } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async downloadDocument(academyId: string, id: string, actor: AuthenticatedUser) {
    const doc = await this.prisma.document.findFirst({ where: { id, academyId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (actor.role === UserRole.STUDENT) {
      if (!doc.isPublished) throw new NotFoundException('Document not found');
      const belt = await this.currentBeltForActor(academyId, actor);
      if (!this.beltAtLeast(belt, doc.minBelt)) {
        throw new ForbiddenException(`This document requires ${doc.minBelt} belt or above`);
      }
    }
    await this.prisma.document.update({ where: { id }, data: { downloadCount: { increment: 1 } } });
    return { url: doc.url, mimeType: doc.mimeType, fileSizeBytes: doc.fileSizeBytes };
  }

  async updateDocument(academyId: string, id: string, input: UpdateDocumentInput, req: AuthenticatedRequest) {
    const before = await this.prisma.document.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Document not found');
    const after = await this.prisma.document.update({ where: { id }, data: input });
    await this.audit.fromRequest(req, 'UPDATE', 'Document', id, { before, after });
    return after;
  }

  async removeDocument(academyId: string, id: string, req: AuthenticatedRequest) {
    const before = await this.prisma.document.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Document not found');
    await this.prisma.document.delete({ where: { id } });
    await this.audit.fromRequest(req, 'DELETE', 'Document', id, { before });
    return { deleted: true };
  }

  // ── Assignments ───────────────────────────────────────────────────────────
  async createAssignment(academyId: string, input: CreateAssignmentInput, req: AuthenticatedRequest) {
    const batch = await this.prisma.batch.findFirst({ where: { id: input.batchId, academyId } });
    if (!batch) throw new NotFoundException('Batch not found');
    const inst = await this.prisma.instructor.findFirst({
      where: { id: input.instructorId, academyId, deletedAt: null },
    });
    if (!inst) throw new NotFoundException('Instructor not found');
    const assignment = await this.prisma.assignment.create({ data: input });
    await this.audit.fromRequest(req, 'CREATE', 'Assignment', assignment.id, { after: assignment });
    return assignment;
  }

  async listAssignmentsForBatch(academyId: string, batchId: string) {
    const batch = await this.prisma.batch.findFirst({ where: { id: batchId, academyId }, select: { id: true } });
    if (!batch) throw new NotFoundException('Batch not found');
    return this.prisma.assignment.findMany({
      where: { batchId },
      orderBy: { dueAt: 'desc' },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { submissions: true } },
      },
    });
  }

  async listAssignmentsForCurrentStudent(academyId: string, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { userId, academyId, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student profile not found');
    const enrollments = await this.prisma.batchStudent.findMany({
      where: { studentId: student.id, leftAt: null },
      select: { batchId: true },
    });
    if (enrollments.length === 0) return [];
    return this.prisma.assignment.findMany({
      where: { batchId: { in: enrollments.map((e) => e.batchId) } },
      orderBy: { dueAt: 'desc' },
      include: {
        batch: { select: { id: true, name: true } },
        instructor: { select: { id: true, firstName: true, lastName: true } },
        submissions: {
          where: { studentId: student.id },
          select: { id: true, submittedAt: true, marks: true, feedback: true, gradedAt: true },
        },
      },
    });
  }

  async findAssignmentForCurrentStudent(academyId: string, userId: string, assignmentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { userId, academyId, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student profile not found');
    const assignment = await this.prisma.assignment.findFirst({
      where: {
        id: assignmentId,
        batch: {
          academyId,
          students: { some: { studentId: student.id, leftAt: null } },
        },
      },
      include: {
        batch: { select: { id: true, name: true } },
        instructor: { select: { id: true, firstName: true, lastName: true } },
        submissions: {
          where: { studentId: student.id },
          select: { id: true, content: true, attachments: true, submittedAt: true, marks: true, feedback: true, gradedAt: true },
        },
      },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return { ...assignment, studentId: student.id };
  }

  async submitAssignment(academyId: string, assignmentId: string, input: SubmitAssignmentInput, actor: AuthenticatedUser, req: AuthenticatedRequest) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, batch: { academyId } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (actor.role === UserRole.STUDENT) {
      const me = await this.prisma.student.findFirst({ where: { userId: actor.id, academyId } });
      if (me?.id !== input.studentId) throw new ForbiddenException('You may only submit your own assignments');
    } else if (actor.role === UserRole.PARENT) {
      const link = await this.prisma.parentStudent.findFirst({
        where: { studentId: input.studentId, parent: { userId: actor.id, academyId } },
      });
      if (!link) throw new ForbiddenException('You may only submit for your children');
    }
    const submission = await this.prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId: input.studentId } },
      create: {
        assignmentId,
        studentId: input.studentId,
        content: input.content,
        attachments: input.attachments ?? [],
      },
      update: {
        content: input.content,
        attachments: input.attachments ?? [],
        submittedAt: new Date(),
      },
    });
    await this.audit.fromRequest(req, 'CREATE', 'AssignmentSubmission', submission.id, { after: submission });
    return submission;
  }

  async gradeSubmission(academyId: string, submissionId: string, input: GradeSubmissionInput, req: AuthenticatedRequest) {
    const submission = await this.prisma.assignmentSubmission.findFirst({
      where: { id: submissionId, assignment: { batch: { academyId } } },
      include: { assignment: true },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (input.marks > submission.assignment.maxMarks) {
      throw new BadRequestException(`Marks cannot exceed max marks (${submission.assignment.maxMarks})`);
    }
    const after = await this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: { marks: input.marks, feedback: input.feedback, gradedAt: new Date() },
    });
    await this.audit.fromRequest(req, 'UPDATE', 'AssignmentSubmission', submissionId, { before: submission, after });
    return after;
  }

  async listSubmissions(academyId: string, assignmentId: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, batch: { academyId } },
      select: { id: true },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return this.prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      include: {
        student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }
}

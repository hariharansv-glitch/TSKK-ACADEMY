import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CertificateType, Prisma, UserRole } from '@prisma/client';
import * as path from 'path';
import { PrismaService } from '@database/prisma.service';
import { AuditLogService } from '@common/services/audit-log.service';
import { PdfService } from '@common/pdf/pdf.service';
import { StorageService } from '@common/storage/storage.service';
import { paginate } from '@common/dto/paginated-response.dto';
import { randomToken } from '@common/utils/hash.util';
import { formatEntityCode } from '@common/utils/ids.util';
import { renderQrDataUrl } from '@common/utils/qr.util';
import type { EnvVars } from '@config/env.validation';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';
import type {
  IssueCertificateInput,
  ListCertificatesQuery,
  RevokeCertificateInput,
} from './dto/certificate.dto';

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  // ── Issue ────────────────────────────────────────────────────────────────
  async issue(academyId: string, input: IssueCertificateInput, req: AuthenticatedRequest) {
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, academyId, deletedAt: null },
      include: { academy: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const cert = await this.createCertificateRow(academyId, {
      studentId: input.studentId,
      type: input.type,
      title: input.title,
      description: input.description,
      validUntil: input.validUntil,
      metadata: input.metadata,
    });

    try {
      const uploaded = await this.renderAndUpload(cert.id);
      const withUrl = await this.prisma.certificate.update({
        where: { id: cert.id },
        data: { fileUrl: uploaded.url },
      });
      await this.audit.fromRequest(req, 'CREATE', 'Certificate', withUrl.id, { after: withUrl });
      return withUrl;
    } catch (err) {
      this.logger.error(`Failed to render certificate PDF for ${cert.id}: ${(err as Error).message}`);
      await this.audit.fromRequest(req, 'CREATE', 'Certificate', cert.id, { after: cert });
      return cert;
    }
  }

  // Used by BeltsService after passing a belt exam
  async issueForBeltExam(academyId: string, beltExamId: string, req: AuthenticatedRequest) {
    const exam = await this.prisma.beltExam.findFirst({
      where: { id: beltExamId, academyId },
      include: { student: true },
    });
    if (!exam) throw new NotFoundException('Belt exam not found');
    if (exam.result !== 'PASSED') {
      throw new BadRequestException('Only passed exams can receive belt promotion certificates');
    }
    return this.issue(
      academyId,
      {
        studentId: exam.studentId,
        type: CertificateType.BELT_PROMOTION,
        title: `${exam.toBelt} Belt Promotion`,
        description: `Awarded upon passing the belt promotion examination from ${exam.fromBelt} to ${exam.toBelt}.`,
        metadata: {
          beltExamId: exam.id,
          fromBelt: exam.fromBelt,
          toBelt: exam.toBelt,
          examDate: exam.examDate,
          totalMarks: exam.totalMarks,
          maxMarks: exam.maxMarks,
        },
      },
      req,
    );
  }

  private async createCertificateRow(
    academyId: string,
    payload: {
      studentId: string;
      type: CertificateType;
      title: string;
      description?: string;
      validUntil?: Date;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const settings = await tx.academySetting.findUnique({ where: { academyId } });
      const prefix = settings?.certificatePrefix ?? 'CERT';
      const count = await tx.certificate.count({ where: { academyId } });
      const certificateNumber = formatEntityCode(prefix, count + 1, 6);
      const verificationCode = randomToken(16).replace(/[^A-Za-z0-9]/g, '').slice(0, 24).toUpperCase();
      const baseVerifyUrl = this.config.get('CERTIFICATE_VERIFICATION_BASE_URL', { infer: true });
      const verificationUrl = `${baseVerifyUrl.replace(/\/+$/, '')}/${verificationCode}`;

      return tx.certificate.create({
        data: {
          academyId,
          studentId: payload.studentId,
          type: payload.type,
          certificateNumber,
          title: payload.title,
          description: payload.description,
          verificationCode,
          verificationUrl,
          validUntil: payload.validUntil,
          metadata: payload.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    });
  }

  // ── PDF rendering + upload ───────────────────────────────────────────────
  private async renderAndUpload(certificateId: string): Promise<{ url: string; key: string }> {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        student: true,
        academy: {
          select: {
            name: true,
            addressLine1: true,
            city: true,
            state: true,
            contactEmail: true,
            contactPhone: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
            tagline: true,
          },
        },
      },
    });
    if (!cert) throw new NotFoundException('Certificate not found');

    const qrDataUrl = await renderQrDataUrl(cert.verificationUrl);
    const templatePath = path.resolve(__dirname, 'templates', 'certificate.hbs');
    const pdfBuffer = await this.pdf.renderTemplate({
      templatePath,
      context: {
        certificate: {
          number: cert.certificateNumber,
          title: cert.title,
          description: cert.description,
          type: cert.type,
          issuedOn: cert.issuedOn.toISOString().slice(0, 10),
          validUntil: cert.validUntil ? cert.validUntil.toISOString().slice(0, 10) : null,
          verificationCode: cert.verificationCode,
          verificationUrl: cert.verificationUrl,
        },
        student: {
          name: `${cert.student.firstName} ${cert.student.lastName}`,
          code: cert.student.studentCode,
          currentBelt: cert.student.currentBelt,
        },
        academy: {
          name: cert.academy.name,
          tagline: cert.academy.tagline,
          address: [cert.academy.addressLine1, cert.academy.city, cert.academy.state].filter(Boolean).join(', '),
          contactEmail: cert.academy.contactEmail,
          contactPhone: cert.academy.contactPhone,
          logoUrl: cert.academy.logoUrl,
        },
        primaryColor: cert.academy.primaryColor ?? '#B91C1C',
        secondaryColor: cert.academy.secondaryColor ?? '#F59E0B',
        qrDataUrl,
      },
      pdfOptions: {
        landscape: true,
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      },
    });

    const uploaded = await this.storage.upload({
      bucket: 'certificates',
      keyPrefix: `academies/${cert.academyId}/certificates`,
      buffer: pdfBuffer,
      mimeType: 'application/pdf',
      originalName: `${cert.certificateNumber}.pdf`,
      metadata: {
        certificateId: cert.id,
        academyId: cert.academyId,
      },
    });
    return { url: uploaded.url, key: uploaded.key };
  }

  async renderPdf(academyId: string, id: string, actor: AuthenticatedUser): Promise<Buffer> {
    const cert = await this.prisma.certificate.findFirst({
      where: { id, academyId },
      include: { student: { select: { id: true, userId: true } } },
    });
    if (!cert) throw new NotFoundException('Certificate not found');
    await this.assertVisibility(academyId, actor, cert.studentId, cert.student.userId);

    const qrDataUrl = await renderQrDataUrl(cert.verificationUrl);
    const templatePath = path.resolve(__dirname, 'templates', 'certificate.hbs');
    const full = await this.prisma.certificate.findUnique({
      where: { id },
      include: {
        student: true,
        academy: {
          select: {
            name: true,
            addressLine1: true,
            city: true,
            state: true,
            contactEmail: true,
            contactPhone: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
            tagline: true,
          },
        },
      },
    });
    if (!full) throw new NotFoundException('Certificate not found');
    return this.pdf.renderTemplate({
      templatePath,
      context: {
        certificate: {
          number: full.certificateNumber,
          title: full.title,
          description: full.description,
          type: full.type,
          issuedOn: full.issuedOn.toISOString().slice(0, 10),
          validUntil: full.validUntil ? full.validUntil.toISOString().slice(0, 10) : null,
          verificationCode: full.verificationCode,
          verificationUrl: full.verificationUrl,
        },
        student: {
          name: `${full.student.firstName} ${full.student.lastName}`,
          code: full.student.studentCode,
          currentBelt: full.student.currentBelt,
        },
        academy: {
          name: full.academy.name,
          tagline: full.academy.tagline,
          address: [full.academy.addressLine1, full.academy.city, full.academy.state].filter(Boolean).join(', '),
          contactEmail: full.academy.contactEmail,
          contactPhone: full.academy.contactPhone,
          logoUrl: full.academy.logoUrl,
        },
        primaryColor: full.academy.primaryColor ?? '#B91C1C',
        secondaryColor: full.academy.secondaryColor ?? '#F59E0B',
        qrDataUrl,
      },
      pdfOptions: {
        landscape: true,
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      },
    });
  }

  // ── Public verification (no tenant scoping) ─────────────────────────────
  async verifyPublic(verificationCode: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { verificationCode },
      include: {
        student: { select: { firstName: true, lastName: true, studentCode: true, currentBelt: true } },
        academy: { select: { name: true, tagline: true, logoUrl: true, city: true, state: true } },
      },
    });
    if (!cert) return { valid: false, reason: 'NOT_FOUND' };
    if (cert.revokedAt) {
      return {
        valid: false,
        reason: 'REVOKED',
        revokedAt: cert.revokedAt,
        revokedReason: cert.revokedReason,
      };
    }
    if (cert.validUntil && cert.validUntil < new Date()) {
      return { valid: false, reason: 'EXPIRED', validUntil: cert.validUntil };
    }
    return {
      valid: true,
      certificate: {
        number: cert.certificateNumber,
        title: cert.title,
        type: cert.type,
        issuedOn: cert.issuedOn,
        validUntil: cert.validUntil,
        description: cert.description,
      },
      student: cert.student,
      academy: cert.academy,
    };
  }

  // ── Listing ──────────────────────────────────────────────────────────────
  async list(academyId: string, actor: AuthenticatedUser, query: ListCertificatesQuery) {
    const where: Prisma.CertificateWhereInput = {
      academyId,
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(!query.includeRevoked ? { revokedAt: null } : {}),
      ...(query.search
        ? {
            OR: [
              { certificateNumber: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
              { student: { firstName: { contains: query.search, mode: 'insensitive' } } },
              { student: { lastName: { contains: query.search, mode: 'insensitive' } } },
              { student: { studentCode: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    if (actor.role === UserRole.PARENT) {
      const links = await this.prisma.parentStudent.findMany({
        where: { parent: { userId: actor.id, academyId } },
        select: { studentId: true },
      });
      where.studentId = { in: links.map((l) => l.studentId) };
    } else if (actor.role === UserRole.STUDENT) {
      const me = await this.prisma.student.findFirst({ where: { userId: actor.id, academyId } });
      where.studentId = me?.id ?? '__none__';
    }
    const [total, rows] = await Promise.all([
      this.prisma.certificate.count({ where }),
      this.prisma.certificate.findMany({
        where,
        orderBy: { issuedOn: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
        },
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async findOne(academyId: string, id: string, actor: AuthenticatedUser) {
    const cert = await this.prisma.certificate.findFirst({
      where: { id, academyId },
      include: {
        student: { select: { id: true, userId: true, studentCode: true, firstName: true, lastName: true } },
      },
    });
    if (!cert) throw new NotFoundException('Certificate not found');
    await this.assertVisibility(academyId, actor, cert.studentId, cert.student.userId);
    return cert;
  }

  async revoke(academyId: string, id: string, input: RevokeCertificateInput, req: AuthenticatedRequest) {
    const before = await this.prisma.certificate.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Certificate not found');
    if (before.revokedAt) throw new BadRequestException('Certificate is already revoked');
    const after = await this.prisma.certificate.update({
      where: { id },
      data: { revokedAt: new Date(), revokedReason: input.reason },
    });
    await this.audit.fromRequest(req, 'UPDATE', 'Certificate', id, { before, after });
    return after;
  }

  // ── Visibility helper ────────────────────────────────────────────────────
  private async assertVisibility(
    academyId: string,
    actor: AuthenticatedUser,
    studentId: string,
    studentUserId: string | null,
  ): Promise<void> {
    if (actor.role === UserRole.SUPER_ADMIN) return;
    if (actor.role === UserRole.STUDENT) {
      if (studentUserId !== actor.id) throw new ForbiddenException('You may only view your own certificates');
      return;
    }
    if (actor.role === UserRole.PARENT) {
      const link = await this.prisma.parentStudent.findFirst({
        where: { studentId, parent: { userId: actor.id, academyId } },
      });
      if (!link) throw new ForbiddenException('You may only view certificates for your children');
    }
  }
}

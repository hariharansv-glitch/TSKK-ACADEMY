import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { AuditLogService } from '@common/services/audit-log.service';
import { paginate } from '@common/dto/paginated-response.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';
import type {
  CreateAnnouncementInput,
  ListAnnouncementsQuery,
  UpdateAnnouncementInput,
} from './dto/announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async create(academyId: string, input: CreateAnnouncementInput, req: AuthenticatedRequest) {
    const row = await this.prisma.announcement.create({
      data: {
        academyId,
        title: input.title,
        body: input.body,
        audience: input.audience,
        isPinned: input.isPinned ?? false,
        publishedAt: input.publishedAt ?? new Date(),
        expiresAt: input.expiresAt,
        attachments: input.attachments ?? [],
        createdBy: req.user?.id,
      },
    });
    await this.audit.fromRequest(req, 'CREATE', 'Announcement', row.id, { after: row });
    return row;
  }

  async list(academyId: string, actor: AuthenticatedUser, query: ListAnnouncementsQuery) {
    const audienceFilter: UserRole = query.audience ?? actor.role;
    const where: Prisma.AnnouncementWhereInput = {
      academyId,
      ...(actor.role !== UserRole.SUPER_ADMIN && actor.role !== UserRole.ACADEMY_ADMIN
        ? { audience: { has: audienceFilter } }
        : query.audience
          ? { audience: { has: audienceFilter } }
          : {}),
      ...(query.activeOnly
        ? {
            publishedAt: { lte: new Date() },
            OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { body: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async findOne(academyId: string, id: string) {
    const row = await this.prisma.announcement.findFirst({ where: { id, academyId } });
    if (!row) throw new NotFoundException('Announcement not found');
    return row;
  }

  async update(academyId: string, id: string, input: UpdateAnnouncementInput, req: AuthenticatedRequest) {
    const before = await this.prisma.announcement.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Announcement not found');
    const after = await this.prisma.announcement.update({ where: { id }, data: input });
    await this.audit.fromRequest(req, 'UPDATE', 'Announcement', id, { before, after });
    return after;
  }

  async remove(academyId: string, id: string, req: AuthenticatedRequest) {
    const before = await this.prisma.announcement.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Announcement not found');
    await this.prisma.announcement.delete({ where: { id } });
    await this.audit.fromRequest(req, 'DELETE', 'Announcement', id, { before });
    return { deleted: true };
  }
}

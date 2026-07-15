import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction, Prisma, UserRole } from '@prisma/client';
import { z } from 'zod';

import { PrismaService } from '@database/prisma.service';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { paginate } from '@common/dto/paginated-response.dto';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

const listAuditSchema = paginationQuerySchema.extend({
  userId: z.string().trim().min(1).max(48).optional(),
  entityType: z.string().trim().min(1).max(80).optional(),
  entityId: z.string().trim().min(1).max(80).optional(),
  action: z.nativeEnum(AuditAction).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
type ListAuditQuery = z.infer<typeof listAuditSchema>;

class AuditRow {}

@ApiTags('audit-logs')
@ApiBearerAuth('access-token')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @UseGuards(TenantGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('audit.view')
  @ApiPaginatedResponse(AuditRow)
  @ApiOperation({ summary: 'List audit-log entries' })
  async list(
    @Tenant({ required: false }) academyId: string | null,
    @Query(new ZodValidationPipe(listAuditSchema)) query: ListAuditQuery,
  ) {
    const where: Prisma.AuditLogWhereInput = {
      ...(academyId ? { academyId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        },
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  @Get(':id')
  @UseGuards(TenantGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('audit.view')
  async detail(
    @Tenant({ required: false }) academyId: string | null,
    @Param('id') id: string,
  ) {
    const where: Prisma.AuditLogWhereInput = { id, ...(academyId ? { academyId } : {}) };
    return this.prisma.auditLog.findFirst({
      where,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
    });
  }
}

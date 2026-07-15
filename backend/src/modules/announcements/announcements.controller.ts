import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { AnnouncementsService } from './announcements.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  CreateAnnouncementDto,
  createAnnouncementSchema,
  ListAnnouncementsQueryDto,
  listAnnouncementsSchema,
  UpdateAnnouncementDto,
  updateAnnouncementSchema,
} from './dto/announcement.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';

class AnnouncementRow {}

@ApiTags('announcements')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('announcement.create')
  create(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createAnnouncementSchema)) body: CreateAnnouncementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(academyId, body as never, req);
  }

  @Get()
  @Permissions('announcement.view')
  @ApiPaginatedResponse(AnnouncementRow)
  list(
    @Tenant({ required: true }) academyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listAnnouncementsSchema)) query: ListAnnouncementsQueryDto,
  ) {
    return this.service.list(academyId, user, query as never);
  }

  @Get(':id')
  @Permissions('announcement.view')
  findOne(@Tenant({ required: true }) academyId: string, @Param('id') id: string) {
    return this.service.findOne(academyId, id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('announcement.update')
  update(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAnnouncementSchema)) body: UpdateAnnouncementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(academyId, id, body as never, req);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('announcement.delete')
  remove(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.remove(academyId, id, req);
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { BeltsService } from './belts.service';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  GradeBeltExamDto,
  gradeBeltExamSchema,
  ListBeltExamsQueryDto,
  listBeltExamsSchema,
  ScheduleBeltExamDto,
  scheduleBeltExamSchema,
} from './dto/belt.dto';
import type { AuthenticatedRequest } from '@common/types/authenticated-request';

class BeltExamRow {}

@ApiTags('belts')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard)
@Controller('belt-exams')
export class BeltsController {
  constructor(private readonly service: BeltsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR)
  @Permissions('belt.schedule')
  @ApiOperation({ summary: 'Schedule a belt promotion exam' })
  schedule(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(scheduleBeltExamSchema)) body: ScheduleBeltExamDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.schedule(academyId, body as never, req);
  }

  @Patch(':id/grade')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR)
  @Permissions('belt.grade')
  @ApiOperation({ summary: 'Grade a belt exam (auto-issues certificate when passed)' })
  grade(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(gradeBeltExamSchema)) body: GradeBeltExamDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.grade(academyId, id, body as never, req);
  }

  @Get()
  @Permissions('belt.view')
  @ApiPaginatedResponse(BeltExamRow)
  list(
    @Tenant({ required: true }) academyId: string,
    @Query(new ZodValidationPipe(listBeltExamsSchema)) query: ListBeltExamsQueryDto,
  ) {
    return this.service.list(academyId, query as never);
  }

  @Get(':id')
  @Permissions('belt.view')
  findOne(@Tenant({ required: true }) academyId: string, @Param('id') id: string) {
    return this.service.findOne(academyId, id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('belt.delete')
  remove(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.remove(academyId, id, req);
  }
}

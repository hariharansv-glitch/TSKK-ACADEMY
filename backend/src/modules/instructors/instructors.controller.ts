import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { InstructorsService } from './instructors.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  CreateInstructorDto,
  createInstructorSchema,
  ListInstructorsQueryDto,
  listInstructorsSchema,
  UpdateInstructorDto,
  updateInstructorSchema,
} from './dto/instructor.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';

class InstructorDtoResponse {}

@ApiTags('instructors')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard)
@Controller('instructors')
export class InstructorsController {
  constructor(private readonly service: InstructorsService) {}

  // ── Self-service ─────────────────────────────────────────────────────────
  @Get('me')
  @Roles(UserRole.INSTRUCTOR, UserRole.ACADEMY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get the current instructor profile' })
  me(@Tenant({ required: true }) academyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findMineByUser(academyId, user.id);
  }

  @Get('me/schedule')
  @Roles(UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Get my active batches with schedules' })
  async mySchedule(@Tenant({ required: true }) academyId: string, @CurrentUser() user: AuthenticatedUser) {
    const me = await this.service.findMineByUser(academyId, user.id);
    return this.service.schedule(academyId, me.id);
  }

  // ── Admin surface ────────────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('instructor.manage')
  @ApiOperation({ summary: 'Register a new instructor' })
  create(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createInstructorSchema)) body: CreateInstructorDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(academyId, body as never, req);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'List instructors' })
  @ApiPaginatedResponse(InstructorDtoResponse)
  list(
    @Tenant({ required: true }) academyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listInstructorsSchema)) query: ListInstructorsQueryDto,
  ) {
    return this.service.list(academyId, query as never, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an instructor by id' })
  detail(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findById(academyId, id, user);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('instructor.manage')
  @ApiOperation({ summary: 'Update instructor details (bank/salary requires instructor.viewSalary)' })
  update(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInstructorSchema)) body: UpdateInstructorDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(academyId, id, body as never, user, req);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('instructor.manage')
  @ApiOperation({ summary: 'Soft-delete / deactivate an instructor' })
  remove(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.remove(academyId, id, req);
  }

  @Get(':id/schedule')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Active-batch schedule for an instructor' })
  schedule(@Tenant({ required: true }) academyId: string, @Param('id') id: string) {
    return this.service.schedule(academyId, id);
  }

  @Get(':id/performance')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('report.view')
  @ApiOperation({ summary: 'Instructor performance metrics' })
  performance(@Tenant({ required: true }) academyId: string, @Param('id') id: string) {
    return this.service.performance(academyId, id);
  }
}

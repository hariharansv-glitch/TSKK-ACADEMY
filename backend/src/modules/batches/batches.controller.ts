import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { BatchesService } from './batches.service';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import type { AuthenticatedRequest } from '@common/types/authenticated-request';
import {
  CreateClassDto,
  createClassSchema,
  ListClassesQueryDto,
  listClassesSchema,
  UpdateClassDto,
  updateClassSchema,
} from './dto/class.dto';
import {
  CreateBatchDto,
  createBatchSchema,
  EnrollStudentDto,
  enrollStudentSchema,
  ListBatchesQueryDto,
  listBatchesSchema,
  UpdateBatchDto,
  updateBatchSchema,
} from './dto/batch.dto';

@ApiTags('batches')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard)
@Controller()
export class BatchesController {
  constructor(private readonly service: BatchesService) {}

  // ── Classes ────────────────────────────────────────────────────────────────
  @Get('classes')
  @Permissions('batch.view')
  @ApiOperation({ summary: 'List classes' })
  listClasses(
    @Tenant({ required: true }) academyId: string,
    @Query(new ZodValidationPipe(listClassesSchema)) query: ListClassesQueryDto,
  ) {
    return this.service.listClasses(academyId, query as never);
  }

  @Post('classes')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('batch.create')
  createClass(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createClassSchema)) body: CreateClassDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createClass(academyId, body as never, req);
  }

  @Get('classes/:id')
  @Permissions('batch.view')
  findClass(@Tenant({ required: true }) academyId: string, @Param('id') id: string) {
    return this.service.findClass(academyId, id);
  }

  @Patch('classes/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('batch.update')
  updateClass(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateClassSchema)) body: UpdateClassDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateClass(academyId, id, body as never, req);
  }

  @Delete('classes/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('batch.delete')
  removeClass(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.removeClass(academyId, id, req);
  }

  // ── Batches ────────────────────────────────────────────────────────────────
  @Get('batches')
  @Permissions('batch.view')
  listBatches(
    @Tenant({ required: true }) academyId: string,
    @Query(new ZodValidationPipe(listBatchesSchema)) query: ListBatchesQueryDto,
  ) {
    return this.service.listBatches(academyId, query as never);
  }

  @Post('batches')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('batch.create')
  createBatch(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createBatchSchema)) body: CreateBatchDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createBatch(academyId, body as never, req);
  }

  @Get('batches/:id')
  @Permissions('batch.view')
  findBatch(@Tenant({ required: true }) academyId: string, @Param('id') id: string) {
    return this.service.findBatch(academyId, id);
  }

  @Patch('batches/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('batch.update')
  updateBatch(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBatchSchema)) body: UpdateBatchDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateBatch(academyId, id, body as never, req);
  }

  @Delete('batches/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('batch.delete')
  removeBatch(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.removeBatch(academyId, id, req);
  }

  @Post('batches/:id/students')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR, UserRole.RECEPTIONIST)
  @Permissions('batch.update')
  enroll(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(enrollStudentSchema)) body: EnrollStudentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.enrollStudent(academyId, id, body as never, req);
  }

  @Delete('batches/:id/students/:studentId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR, UserRole.RECEPTIONIST)
  @Permissions('batch.update')
  unenroll(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.removeStudent(academyId, id, studentId, req);
  }
}

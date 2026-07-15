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

import { LearningService } from './learning.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  CreateAssignmentDto,
  createAssignmentSchema,
  CreateDocumentDto,
  createDocumentSchema,
  CreateVideoDto,
  createVideoSchema,
  GradeSubmissionDto,
  gradeSubmissionSchema,
  ListDocumentsQueryDto,
  listDocumentsSchema,
  ListVideosQueryDto,
  listVideosSchema,
  SubmitAssignmentDto,
  submitAssignmentSchema,
  UpdateDocumentDto,
  updateDocumentSchema,
  UpdateVideoDto,
  updateVideoSchema,
} from './dto/learning.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';

class LearningRow {}

@ApiTags('learning')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard)
@Controller('learning')
export class LearningController {
  constructor(private readonly service: LearningService) {}

  // ── Videos ────────────────────────────────────────────────────────────────
  @Post('videos')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR)
  @Permissions('video.create')
  @ApiOperation({ summary: 'Publish a training video' })
  createVideo(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createVideoSchema)) body: CreateVideoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createVideo(academyId, body as never, req);
  }

  @Get('videos')
  @Permissions('video.view')
  @ApiPaginatedResponse(LearningRow)
  listVideos(
    @Tenant({ required: true }) academyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listVideosSchema)) query: ListVideosQueryDto,
  ) {
    return this.service.listVideos(academyId, user, query as never);
  }

  @Get('videos/:id')
  @Permissions('video.view')
  findVideo(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findVideo(academyId, id, user);
  }

  @Patch('videos/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR)
  @Permissions('video.update')
  updateVideo(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateVideoSchema)) body: UpdateVideoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateVideo(academyId, id, body as never, req);
  }

  @Delete('videos/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('video.delete')
  removeVideo(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.removeVideo(academyId, id, req);
  }

  // ── Documents ─────────────────────────────────────────────────────────────
  @Post('documents')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR)
  @Permissions('document.create')
  @ApiOperation({ summary: 'Upload a training document' })
  createDocument(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createDocumentSchema)) body: CreateDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createDocument(academyId, body as never, req);
  }

  @Get('documents')
  @Permissions('document.view')
  @ApiPaginatedResponse(LearningRow)
  listDocuments(
    @Tenant({ required: true }) academyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listDocumentsSchema)) query: ListDocumentsQueryDto,
  ) {
    return this.service.listDocuments(academyId, user, query as never);
  }

  @Get('documents/:id/download')
  @Permissions('document.view')
  download(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.downloadDocument(academyId, id, user);
  }

  @Patch('documents/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR)
  @Permissions('document.update')
  updateDocument(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDocumentSchema)) body: UpdateDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateDocument(academyId, id, body as never, req);
  }

  @Delete('documents/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('document.delete')
  removeDocument(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.removeDocument(academyId, id, req);
  }

  // ── Assignments ───────────────────────────────────────────────────────────
  @Post('assignments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR)
  @Permissions('assignment.create')
  createAssignment(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createAssignmentSchema)) body: CreateAssignmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createAssignment(academyId, body as never, req);
  }

  @Get('batches/:batchId/assignments')
  @Permissions('assignment.view')
  listAssignments(
    @Tenant({ required: true }) academyId: string,
    @Param('batchId') batchId: string,
  ) {
    return this.service.listAssignmentsForBatch(academyId, batchId);
  }

  @Get('me/assignments')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'List assignments across all batches the current student is in' })
  myAssignments(
    @Tenant({ required: true }) academyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listAssignmentsForCurrentStudent(academyId, user.id);
  }

  @Get('me/assignments/:id')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Load an assignment (and my submission) as the current student' })
  myAssignment(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAssignmentForCurrentStudent(academyId, user.id, id);
  }

  @Post('assignments/:id/submit')
  @Permissions('assignment.submit')
  submit(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(submitAssignmentSchema)) body: SubmitAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.submitAssignment(academyId, id, body as never, user, req);
  }

  @Patch('submissions/:id/grade')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR)
  @Permissions('assignment.grade')
  grade(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(gradeSubmissionSchema)) body: GradeSubmissionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.gradeSubmission(academyId, id, body as never, req);
  }

  @Get('assignments/:id/submissions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR)
  @Permissions('assignment.view')
  submissions(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
  ) {
    return this.service.listSubmissions(academyId, id);
  }
}

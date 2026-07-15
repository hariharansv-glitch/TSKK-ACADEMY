import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';

import { StudentsService } from './students.service';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';

import { CreateStudentDto, createStudentSchema } from './dto/create-student.dto';
import { UpdateStudentDto, updateStudentSchema } from './dto/update-student.dto';
import {
  AssignBatchDto,
  assignBatchSchema,
  HistoryEntryDto,
  historyEntrySchema,
  ListStudentsQueryDto,
  listStudentsSchema,
} from './dto/list-students.dto';
import type { AuthenticatedRequest } from '@common/types/authenticated-request';

class StudentDtoResponse {}

@ApiTags('students')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST)
  @Permissions('student.create')
  @ApiOperation({ summary: 'Register a new student' })
  create(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createStudentSchema)) body: CreateStudentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(academyId, body as never, req);
  }

  @Get()
  @Permissions('student.view')
  @ApiOperation({ summary: 'List students with search and filters' })
  @ApiPaginatedResponse(StudentDtoResponse)
  list(
    @Tenant({ required: true }) academyId: string,
    @Query(new ZodValidationPipe(listStudentsSchema)) query: ListStudentsQueryDto,
  ) {
    return this.service.list(academyId, query as never);
  }

  @Get('export/csv')
  @Permissions('student.export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="students.csv"')
  @ApiOperation({ summary: 'Export students as CSV' })
  @ApiProduces('text/csv')
  async exportCsv(
    @Tenant({ required: true }) academyId: string,
    @Query(new ZodValidationPipe(listStudentsSchema)) query: ListStudentsQueryDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const csv = await this.service.exportCsv(academyId, query as never);
    res.send(csv);
  }

  @Get('export/pdf')
  @Permissions('student.export')
  @ApiOperation({ summary: 'Export students report as PDF' })
  @ApiProduces('application/pdf')
  async exportPdf(
    @Tenant({ required: true }) academyId: string,
    @Query(new ZodValidationPipe(listStudentsSchema)) query: ListStudentsQueryDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const pdf = await this.service.exportPdf(academyId, query as never);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="students.pdf"');
    res.setHeader('Content-Length', pdf.length.toString());
    res.end(pdf);
  }

  @Get('by-code/:code')
  @Permissions('student.view')
  @ApiOperation({ summary: 'Get a student by student code' })
  byCode(@Tenant({ required: true }) academyId: string, @Param('code') code: string) {
    return this.service.findByCode(academyId, code);
  }

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get the currently signed-in student profile' })
  async me(
    @Tenant({ required: true }) academyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.findByUserId(academyId, req.user!.id);
  }

  @Get('me/qr.png')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'QR code (PNG) for the currently signed-in student' })
  @ApiProduces('image/png')
  async meQrPng(
    @Tenant({ required: true }) academyId: string,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: false }) res: Response,
  ) {
    const student = await this.service.findByUserId(academyId, req.user!.id);
    const png = await this.service.getQrPng(academyId, student.id);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(png);
  }

  @Get(':id')
  @Permissions('student.view')
  @ApiOperation({ summary: 'Get a student by id' })
  detail(@Tenant({ required: true }) academyId: string, @Param('id') id: string) {
    return this.service.findById(academyId, id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST)
  @Permissions('student.update')
  @ApiOperation({ summary: 'Update a student profile' })
  update(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStudentSchema)) body: UpdateStudentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(academyId, id, body as never, req);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('student.delete')
  @ApiOperation({ summary: 'Soft-delete a student' })
  remove(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.remove(academyId, id, req);
  }

  @Post(':id/photo')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST)
  @Permissions('student.update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload / replace a student photo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  uploadPhoto(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.uploadPhoto(academyId, id, file, req);
  }

  @Get(':id/qr.png')
  @Permissions('student.view')
  @ApiOperation({ summary: 'Return the signed QR code for a student as PNG' })
  @ApiProduces('image/png')
  async qrPng(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const png = await this.service.getQrPng(academyId, id);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(png);
  }

  @Get(':id/history')
  @Permissions('student.view')
  @ApiOperation({ summary: 'Return the audit / history log for a student' })
  history(@Tenant({ required: true }) academyId: string, @Param('id') id: string) {
    return this.service.listHistory(academyId, id);
  }

  @Post(':id/history')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR, UserRole.RECEPTIONIST)
  @Permissions('student.update')
  @ApiOperation({ summary: 'Add an entry to a student history log' })
  addHistory(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(historyEntrySchema)) body: HistoryEntryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.addHistory(academyId, id, body as never, req);
  }

  @Post(':id/batches')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST)
  @Permissions('student.update')
  @ApiOperation({ summary: 'Enrol a student in a batch' })
  addBatch(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignBatchSchema)) body: AssignBatchDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.addToBatch(academyId, id, body as never, req);
  }

  @Delete(':id/batches/:batchId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST)
  @Permissions('student.update')
  @ApiOperation({ summary: 'Un-enrol a student from a batch' })
  removeBatch(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Param('batchId') batchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.removeFromBatch(academyId, id, batchId, req);
  }
}

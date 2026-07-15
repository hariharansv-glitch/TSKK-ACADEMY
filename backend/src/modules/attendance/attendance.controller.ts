import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';

import { AttendanceService } from './attendance.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  BulkMarkDto,
  bulkMarkSchema,
  CreateHolidayDto,
  createHolidaySchema,
  ListAttendanceQueryDto,
  listAttendanceSchema,
  MarkAttendanceDto,
  markAttendanceSchema,
  ScanQrDto,
  scanQrSchema,
} from './dto/attendance.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';

class AttendanceRow {}

@ApiTags('attendance')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Post('scan')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR, UserRole.RECEPTIONIST)
  @Permissions('attendance.mark')
  @ApiOperation({ summary: 'Check in a student via signed QR payload' })
  scan(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(scanQrSchema)) body: ScanQrDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.scan(academyId, body as never, req);
  }

  @Post('mark')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR, UserRole.RECEPTIONIST)
  @Permissions('attendance.mark')
  @ApiOperation({ summary: 'Manually mark attendance for a single student' })
  mark(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(markAttendanceSchema)) body: MarkAttendanceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.mark(academyId, body as never, req);
  }

  @Post('bulk')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR)
  @Permissions('attendance.mark')
  @ApiOperation({ summary: 'Mark attendance for an entire batch in one call (upserts)' })
  bulk(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(bulkMarkSchema)) body: BulkMarkDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.bulkMark(academyId, body as never, req);
  }

  @Get()
  @Permissions('attendance.view')
  @ApiPaginatedResponse(AttendanceRow)
  @ApiOperation({ summary: 'Query attendance records' })
  list(
    @Tenant({ required: true }) academyId: string,
    @Query(new ZodValidationPipe(listAttendanceSchema)) query: ListAttendanceQueryDto,
  ) {
    return this.service.list(academyId, query as never);
  }

  @Get('students/:studentId/summary')
  @Permissions('attendance.view')
  @ApiOperation({ summary: 'Per-student attendance summary for a date range' })
  async summary(
    @Tenant({ required: true }) academyId: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    await this.service.assertParentCanReadStudent(academyId, user, studentId);
    return this.service.studentSummary(
      academyId,
      studentId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('batches/:batchId/report')
  @Permissions('attendance.view')
  @ApiOperation({ summary: 'Daily attendance report for a batch' })
  batchReport(
    @Tenant({ required: true }) academyId: string,
    @Param('batchId') batchId: string,
    @Query('date') date: string,
  ) {
    return this.service.batchDailyReport(academyId, batchId, new Date(date));
  }

  @Get('export/csv')
  @Permissions('attendance.export')
  @ApiOperation({ summary: 'Export attendance rows as CSV' })
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="attendance.csv"')
  async exportCsv(
    @Tenant({ required: true }) academyId: string,
    @Query(new ZodValidationPipe(listAttendanceSchema)) query: ListAttendanceQueryDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const csv = await this.service.exportCsv(academyId, query as never);
    res.send(csv);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('attendance.mark')
  @ApiOperation({ summary: 'Delete an attendance record' })
  remove(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.remove(academyId, id, req);
  }

  // ── Holidays ─────────────────────────────────────────────────────────────
  @Get('holidays')
  @Permissions('attendance.view')
  @ApiOperation({ summary: 'List holidays for a year' })
  holidays(
    @Tenant({ required: true }) academyId: string,
    @Query('year') year?: string,
  ) {
    return this.service.listHolidays(academyId, year ? Number(year) : undefined);
  }

  @Post('holidays')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('settings.update')
  @ApiOperation({ summary: 'Add a holiday' })
  addHoliday(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createHolidaySchema)) body: CreateHolidayDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createHoliday(academyId, body as never, req);
  }

  @Delete('holidays/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('settings.update')
  @ApiOperation({ summary: 'Delete a holiday' })
  removeHoliday(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.removeHoliday(academyId, id, req);
  }
}

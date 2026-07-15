import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { ReportsService } from './reports.service';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';

@ApiTags('reports')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('dashboard')
  @UseGuards(TenantGuard)
  @Permissions('report.view')
  @ApiOperation({ summary: 'High-level KPIs for the academy dashboard' })
  dashboard(@Tenant({ required: true }) academyId: string) {
    return this.service.dashboard(academyId);
  }

  @Get('revenue')
  @UseGuards(TenantGuard)
  @Permissions('report.view')
  @ApiOperation({ summary: 'Monthly revenue trend for a date range' })
  revenue(
    @Tenant({ required: true }) academyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.revenue(academyId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('attendance-overview')
  @UseGuards(TenantGuard)
  @Permissions('report.view')
  attendanceOverview(
    @Tenant({ required: true }) academyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.attendanceOverview(academyId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('dropouts')
  @UseGuards(TenantGuard)
  @Permissions('report.view')
  dropouts(
    @Tenant({ required: true }) academyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.dropouts(academyId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('belt-progression')
  @UseGuards(TenantGuard)
  @Permissions('report.view')
  beltProgression(@Tenant({ required: true }) academyId: string) {
    return this.service.beltProgression(academyId);
  }

  @Get('platform')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform-wide analytics for super admin' })
  platform() {
    return this.service.platformOverview();
  }
}

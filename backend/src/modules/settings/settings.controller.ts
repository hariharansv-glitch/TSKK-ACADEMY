import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { SettingsService } from './settings.service';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { UpdateSettingsDto, updateSettingsSchema } from './dto/settings.dto';
import type { AuthenticatedRequest } from '@common/types/authenticated-request';

@ApiTags('settings')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @Permissions('settings.view')
  @ApiOperation({ summary: 'Fetch settings for the current academy' })
  get(@Tenant({ required: true }) academyId: string) {
    return this.service.get(academyId);
  }

  @Patch()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('settings.update')
  @ApiOperation({ summary: 'Update settings for the current academy' })
  update(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(updateSettingsSchema)) body: UpdateSettingsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(academyId, body as never, req);
  }
}

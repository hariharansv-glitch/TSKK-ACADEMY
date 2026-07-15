import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';

import { CertificatesService } from './certificates.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  IssueCertificateDto,
  issueCertificateSchema,
  ListCertificatesQueryDto,
  listCertificatesSchema,
  RevokeCertificateDto,
  revokeCertificateSchema,
} from './dto/certificate.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';

class CertificateRow {}

@ApiTags('certificates')
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly service: CertificatesService) {}

  // ── Public verification endpoint (no auth) ──────────────────────────────
  @Public()
  @Get('verify/:code')
  @ApiOperation({ summary: 'Publicly verify a certificate by its verification code' })
  verify(@Param('code') code: string) {
    return this.service.verifyPublic(code);
  }

  // ── Authenticated tenant-scoped routes ──────────────────────────────────
  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(TenantGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR)
  @Permissions('certificate.issue')
  @ApiOperation({ summary: 'Issue a certificate (belt promotion, achievement, participation, etc.)' })
  issue(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(issueCertificateSchema)) body: IssueCertificateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.issue(academyId, body as never, req);
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(TenantGuard)
  @Permissions('certificate.view')
  @ApiPaginatedResponse(CertificateRow)
  list(
    @Tenant({ required: true }) academyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listCertificatesSchema)) query: ListCertificatesQueryDto,
  ) {
    return this.service.list(academyId, user, query as never);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(TenantGuard)
  @Permissions('certificate.view')
  findOne(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(academyId, id, user);
  }

  @Get(':id/pdf')
  @ApiBearerAuth('access-token')
  @UseGuards(TenantGuard)
  @Permissions('certificate.view')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Download the PDF for a certificate' })
  async pdf(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: false }) res: Response,
  ) {
    const buf = await this.service.renderPdf(academyId, id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${id}.pdf"`);
    res.setHeader('Content-Length', buf.length.toString());
    res.end(buf);
  }

  @Patch(':id/revoke')
  @ApiBearerAuth('access-token')
  @UseGuards(TenantGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('certificate.revoke')
  revoke(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(revokeCertificateSchema)) body: RevokeCertificateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.revoke(academyId, id, body as never, req);
  }
}

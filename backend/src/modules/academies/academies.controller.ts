import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { AcademiesService } from './academies.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';

import { CreateAcademyDto, createAcademySchema } from './dto/create-academy.dto';
import { UpdateAcademyDto, updateAcademySchema } from './dto/update-academy.dto';
import {
  ListAcademiesQueryDto,
  listAcademiesSchema,
} from './dto/list-academies.dto';
import {
  SuspendAcademyDto,
  suspendAcademySchema,
  UpdateSubscriptionDto,
  updateSubscriptionSchema,
} from './dto/subscription.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';

class AcademyDtoResponse {}

@ApiTags('academies')
@ApiBearerAuth('access-token')
@Controller('academies')
export class AcademiesController {
  constructor(private readonly service: AcademiesService) {}

  // ── Super Admin: full lifecycle ─────────────────────────────────────────
  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new academy tenant (super-admin only)' })
  @UsePipes(new ZodValidationPipe(createAcademySchema))
  create(@Body() body: CreateAcademyDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(body, req);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List academies with pagination and filters (super-admin)' })
  @ApiPaginatedResponse(AcademyDtoResponse)
  list(@Query(new ZodValidationPipe(listAcademiesSchema)) query: ListAcademiesQueryDto) {
    return this.service.list(query as never);
  }

  @Get('analytics')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform-wide analytics for super admins' })
  analytics() {
    return this.service.platformAnalytics();
  }

  // ── Public academy discovery (used on login page to render branding) ────
  @Public()
  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Public lookup of an academy by slug' })
  bySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  // ── Detail: super admin any / others own-academy ─────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Get an academy by id' })
  detail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    this.service.assertOwnership(user.academyId, user.role, id);
    return this.service.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @ApiOperation({ summary: 'Update academy details' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAcademySchema)) body: UpdateAcademyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthenticatedRequest,
  ) {
    this.service.assertOwnership(user.academyId, user.role, id);
    return this.service.update(id, body, req);
  }

  @Post(':id/suspend')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend an academy (super-admin only)' })
  suspend(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(suspendAcademySchema)) body: SuspendAcademyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.setStatus(id, 'SUSPENDED', body.reason, req);
  }

  @Post(':id/reactivate')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a suspended academy' })
  reactivate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.setStatus(id, 'ACTIVE', 'Reactivated by super admin', req);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft-delete an academy (must be suspended first)' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.softDelete(id, req);
  }

  // ── Subscription management ─────────────────────────────────────────────
  @Get(':id/subscription')
  @ApiOperation({ summary: 'Return the subscription for an academy' })
  getSubscription(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    this.service.assertOwnership(user.academyId, user.role, id);
    return this.service.getSubscription(id);
  }

  @Patch(':id/subscription')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an academy subscription (super-admin only)' })
  updateSubscription(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSubscriptionSchema)) body: UpdateSubscriptionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateSubscription(id, body, req);
  }
}

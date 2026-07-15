import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { EventsService } from './events.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  CreateEventDto,
  createEventSchema,
  ListEventsQueryDto,
  listEventsSchema,
  RegisterForEventDto,
  registerForEventSchema,
  UpdateEventDto,
  updateEventSchema,
} from './dto/event.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';

class EventRow {}

@ApiTags('events')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('event.create')
  @ApiOperation({ summary: 'Create an event' })
  create(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createEventSchema)) body: CreateEventDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(academyId, body as never, req);
  }

  @Get()
  @Permissions('event.view')
  @ApiPaginatedResponse(EventRow)
  list(
    @Tenant({ required: true }) academyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listEventsSchema)) query: ListEventsQueryDto,
  ) {
    return this.service.list(academyId, user, query as never);
  }

  @Get('slug/:slug')
  @Permissions('event.view')
  findBySlug(@Tenant({ required: true }) academyId: string, @Param('slug') slug: string) {
    return this.service.findBySlug(academyId, slug);
  }

  @Get(':id')
  @Permissions('event.view')
  findOne(@Tenant({ required: true }) academyId: string, @Param('id') id: string) {
    return this.service.findOne(academyId, id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('event.update')
  update(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateEventSchema)) body: UpdateEventDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(academyId, id, body as never, req);
  }

  @Patch(':id/publish')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('event.update')
  publish(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.publish(academyId, id, req);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('event.delete')
  remove(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.remove(academyId, id, req);
  }

  // ── Registrations ────────────────────────────────────────────────────────
  @Post(':id/register')
  @Permissions('event.register')
  register(
    @Tenant({ required: true }) academyId: string,
    @Param('id') eventId: string,
    @Body(new ZodValidationPipe(registerForEventSchema)) body: RegisterForEventDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.register(academyId, eventId, body.studentId, user, req);
  }

  @Get(':id/registrations')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR, UserRole.RECEPTIONIST)
  @Permissions('event.view')
  registrations(
    @Tenant({ required: true }) academyId: string,
    @Param('id') eventId: string,
  ) {
    return this.service.listRegistrations(academyId, eventId);
  }

  @Delete(':id/registrations/:registrationId')
  cancelRegistration(
    @Tenant({ required: true }) academyId: string,
    @Param('id') eventId: string,
    @Param('registrationId') registrationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cancelRegistration(academyId, eventId, registrationId, user, req);
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { NotificationsService } from './notifications.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  ListNotificationsQueryDto,
  listNotificationsSchema,
  RegisterPushSubscriptionDto,
  registerPushSubscriptionSchema,
  SendNotificationDto,
  sendNotificationSchema,
} from './dto/notification.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';

class NotificationRow {}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Public()
  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Get the public VAPID key for Web Push subscription' })
  vapidPublicKey() {
    return this.service.getPublicVapidKey();
  }

  @Post('send')
  @ApiBearerAuth('access-token')
  @UseGuards(TenantGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('notification.send')
  @ApiOperation({ summary: 'Send a notification via one or more channels' })
  send(
    @Tenant({ required: false }) academyId: string | null,
    @Body(new ZodValidationPipe(sendNotificationSchema)) body: SendNotificationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.send(academyId ?? null, body as never, req);
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(TenantGuard)
  @Permissions('notification.view')
  @ApiPaginatedResponse(NotificationRow)
  list(
    @Tenant({ required: false }) academyId: string | null,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listNotificationsSchema)) query: ListNotificationsQueryDto,
  ) {
    return this.service.list(academyId ?? null, user, query as never);
  }

  @Patch(':id/read')
  @ApiBearerAuth('access-token')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.markRead(id, user);
  }

  @Patch('read-all')
  @ApiBearerAuth('access-token')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.service.markAllRead(user);
  }

  @Post('push/subscribe')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Register a Web Push subscription for the current user' })
  subscribe(
    @Body(new ZodValidationPipe(registerPushSubscriptionSchema)) body: RegisterPushSubscriptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.registerPushSubscription(user, body as never);
  }

  @Delete('push/subscribe')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove a Web Push subscription for the current user' })
  unsubscribe(@Body('endpoint') endpoint: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.removePushSubscription(user, endpoint);
  }
}

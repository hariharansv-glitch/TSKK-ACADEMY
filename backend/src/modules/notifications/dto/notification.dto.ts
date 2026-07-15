import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationPriority, NotificationStatus, UserRole } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const sendNotificationSchema = z
  .object({
    channels: z.array(z.nativeEnum(NotificationChannel)).min(1).max(5),
    subject: z.string().trim().max(200).optional(),
    body: z.string().trim().min(1).max(20_000),
    priority: z.nativeEnum(NotificationPriority).optional().default(NotificationPriority.NORMAL),
    templateId: z.string().trim().max(120).optional(),
    data: z.record(z.unknown()).optional(),
    userIds: z.array(z.string().trim().min(1).max(48)).max(2000).optional(),
    roles: z.array(z.nativeEnum(UserRole)).max(20).optional(),
    scheduledFor: z.coerce.date().optional(),
  })
  .refine((v) => (v.userIds && v.userIds.length > 0) || (v.roles && v.roles.length > 0), {
    message: 'Provide at least one recipient (userIds or roles)',
    path: ['userIds'],
  });
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
export class SendNotificationDto {
  @ApiProperty({ enum: NotificationChannel, isArray: true }) channels!: NotificationChannel[];
  @ApiPropertyOptional() subject?: string;
  @ApiProperty() body!: string;
  @ApiPropertyOptional({ enum: NotificationPriority }) priority?: NotificationPriority;
  @ApiPropertyOptional() templateId?: string;
  @ApiPropertyOptional() data?: Record<string, unknown>;
  @ApiPropertyOptional({ type: [String] }) userIds?: string[];
  @ApiPropertyOptional({ enum: UserRole, isArray: true }) roles?: UserRole[];
  @ApiPropertyOptional() scheduledFor?: Date;
}

export const listNotificationsSchema = paginationQuerySchema.extend({
  channel: z.nativeEnum(NotificationChannel).optional(),
  status: z.nativeEnum(NotificationStatus).optional(),
  userId: z.string().trim().min(1).max(48).optional(),
  unreadOnly: z.coerce.boolean().optional(),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;
export class ListNotificationsQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional({ enum: NotificationChannel }) channel?: NotificationChannel;
  @ApiPropertyOptional({ enum: NotificationStatus }) status?: NotificationStatus;
  @ApiPropertyOptional() userId?: string;
  @ApiPropertyOptional() unreadOnly?: boolean;
}

export const registerPushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(200),
  }),
  userAgent: z.string().max(500).optional(),
});
export type RegisterPushInput = z.infer<typeof registerPushSubscriptionSchema>;
export class RegisterPushSubscriptionDto {
  @ApiProperty() endpoint!: string;
  @ApiProperty() keys!: { p256dh: string; auth: string };
  @ApiPropertyOptional() userAgent?: string;
}

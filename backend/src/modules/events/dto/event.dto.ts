import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus, EventType } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const createEventSchema = z
  .object({
    slug: z.string().trim().min(3).max(120).regex(/^[a-z0-9-]+$/).optional(),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().min(1).max(5000),
    type: z.nativeEnum(EventType),
    status: z.nativeEnum(EventStatus).optional().default(EventStatus.DRAFT),
    bannerUrl: z.string().url().optional(),
    venue: z.string().trim().min(1).max(200),
    addressLine1: z.string().trim().max(200).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    registrationStartAt: z.coerce.date().optional(),
    registrationEndAt: z.coerce.date().optional(),
    capacity: z.coerce.number().int().min(1).max(100_000).optional(),
    feePaise: z.coerce.number().int().min(0).default(0),
    isPaid: z.coerce.boolean().optional().default(false),
    requiresApproval: z.coerce.boolean().optional().default(false),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((v) => v.endAt > v.startAt, { message: 'endAt must be after startAt', path: ['endAt'] });
export type CreateEventInput = z.infer<typeof createEventSchema>;
export class CreateEventDto {
  @ApiPropertyOptional() slug?: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: EventType }) type!: EventType;
  @ApiPropertyOptional({ enum: EventStatus }) status?: EventStatus;
  @ApiPropertyOptional() bannerUrl?: string;
  @ApiProperty() venue!: string;
  @ApiPropertyOptional() addressLine1?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() state?: string;
  @ApiProperty({ type: String, format: 'date-time' }) startAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) endAt!: Date;
  @ApiPropertyOptional() registrationStartAt?: Date;
  @ApiPropertyOptional() registrationEndAt?: Date;
  @ApiPropertyOptional() capacity?: number;
  @ApiPropertyOptional({ default: 0 }) feePaise?: number = 0;
  @ApiPropertyOptional({ default: false }) isPaid?: boolean = false;
  @ApiPropertyOptional({ default: false }) requiresApproval?: boolean = false;
  @ApiPropertyOptional() metadata?: Record<string, unknown>;
}

export const updateEventSchema = createEventSchema.innerType().partial();
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export class UpdateEventDto extends CreateEventDto {}

export const listEventsSchema = paginationQuerySchema.extend({
  status: z.nativeEnum(EventStatus).optional(),
  type: z.nativeEnum(EventType).optional(),
  upcomingOnly: z.coerce.boolean().optional(),
});
export type ListEventsQuery = z.infer<typeof listEventsSchema>;
export class ListEventsQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional({ enum: EventStatus }) status?: EventStatus;
  @ApiPropertyOptional({ enum: EventType }) type?: EventType;
  @ApiPropertyOptional() upcomingOnly?: boolean;
}

export const registerForEventSchema = z.object({
  studentId: z.string().trim().min(1).max(48),
});
export type RegisterForEventInput = z.infer<typeof registerForEventSchema>;
export class RegisterForEventDto {
  @ApiProperty() studentId!: string;
}

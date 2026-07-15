import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(1).max(20_000),
  audience: z.array(z.nativeEnum(UserRole)).min(1).max(20),
  isPinned: z.coerce.boolean().optional().default(false),
  publishedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  attachments: z.array(z.string().url()).max(10).optional().default([]),
});
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export class CreateAnnouncementDto {
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ enum: UserRole, isArray: true }) audience!: UserRole[];
  @ApiPropertyOptional({ default: false }) isPinned?: boolean;
  @ApiPropertyOptional() publishedAt?: Date;
  @ApiPropertyOptional() expiresAt?: Date;
  @ApiPropertyOptional({ type: [String] }) attachments?: string[];
}

export const updateAnnouncementSchema = createAnnouncementSchema.partial();
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export class UpdateAnnouncementDto extends CreateAnnouncementDto {}

export const listAnnouncementsSchema = paginationQuerySchema.extend({
  audience: z.nativeEnum(UserRole).optional(),
  activeOnly: z.coerce.boolean().optional().default(true),
});
export type ListAnnouncementsQuery = z.infer<typeof listAnnouncementsSchema>;
export class ListAnnouncementsQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional({ enum: UserRole }) audience?: UserRole;
  @ApiPropertyOptional({ default: true }) activeOnly?: boolean;
}

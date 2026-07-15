import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(20).optional(),
  role: z.nativeEnum(UserRole),
  sendInvite: z.coerce.boolean().optional().default(true),
  locale: z.string().trim().max(8).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export class CreateUserDto implements CreateUserInput {
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiPropertyOptional() phone?: string;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
  @ApiPropertyOptional({ default: true }) sendInvite: boolean = true;
  @ApiPropertyOptional() locale?: string;
}

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  displayName: z.string().trim().max(160).nullable().optional(),
  phone: z.string().trim().min(6).max(20).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  locale: z.string().trim().max(8).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export class UpdateUserDto implements UpdateUserInput {
  @ApiPropertyOptional() firstName?: string;
  @ApiPropertyOptional() lastName?: string;
  @ApiPropertyOptional() displayName?: string | null;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional() avatarUrl?: string | null;
  @ApiPropertyOptional() locale?: string;
}

export const setRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});
export type SetRoleInput = z.infer<typeof setRoleSchema>;
export class SetRoleDto implements SetRoleInput {
  @ApiProperty({ enum: UserRole }) role!: UserRole;
}

export const setStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
  reason: z.string().trim().max(500).optional(),
});
export type SetStatusInput = z.infer<typeof setStatusSchema>;
export class SetStatusDto implements SetStatusInput {
  @ApiProperty({ enum: UserStatus }) status!: UserStatus;
  @ApiPropertyOptional() reason?: string;
}

export const listUsersSchema = paginationQuerySchema.extend({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersSchema>;
export class ListUsersQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional({ enum: UserRole }) role?: UserRole;
  @ApiPropertyOptional({ enum: UserStatus }) status?: UserStatus;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { PASSWORD_REGEX, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_POLICY_MESSAGE } from './password.constants';

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH)
    .max(PASSWORD_MAX_LENGTH)
    .regex(PASSWORD_REGEX, PASSWORD_POLICY_MESSAGE),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(20).optional(),
  role: z.nativeEnum(UserRole).default(UserRole.STUDENT),
  academySlug: z.string().trim().min(1).max(96).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export class RegisterDto implements RegisterInput {
  @ApiProperty({ example: 'arjun@example.com' }) email!: string;
  @ApiProperty({ example: 'Str0ng!Pass' }) password!: string;
  @ApiProperty({ example: 'Arjun' }) firstName!: string;
  @ApiProperty({ example: 'Mohan' }) lastName!: string;
  @ApiPropertyOptional({ example: '+919000000000' }) phone?: string;
  @ApiPropertyOptional({ enum: UserRole, default: UserRole.STUDENT }) role: UserRole = UserRole.STUDENT;
  @ApiPropertyOptional({ description: 'Slug of the academy this user belongs to' }) academySlug?: string;
}

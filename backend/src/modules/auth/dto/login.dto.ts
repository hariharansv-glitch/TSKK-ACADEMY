import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
  rememberMe: z.coerce.boolean().optional().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

export class LoginDto implements LoginInput {
  @ApiProperty({ example: 'admin@tskk.in' }) email!: string;
  @ApiProperty({ example: 'ChangeMe#2026' }) password!: string;
  @ApiPropertyOptional({ default: false }) rememberMe: boolean = false;
}

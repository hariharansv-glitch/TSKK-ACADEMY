import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export class ForgotPasswordDto implements ForgotPasswordInput {
  @ApiProperty() email!: string;
}

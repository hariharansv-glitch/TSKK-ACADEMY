import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const verifyEmailSchema = z.object({
  token: z.string().min(20).max(4096),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export class VerifyEmailDto implements VerifyEmailInput {
  @ApiProperty() token!: string;
}

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export class ResendVerificationDto implements ResendVerificationInput {
  @ApiProperty() email!: string;
}

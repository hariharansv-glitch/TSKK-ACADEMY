import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import { PASSWORD_REGEX, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_POLICY_MESSAGE } from './password.constants';

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(4096),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH)
    .max(PASSWORD_MAX_LENGTH)
    .regex(PASSWORD_REGEX, PASSWORD_POLICY_MESSAGE),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export class ResetPasswordDto implements ResetPasswordInput {
  @ApiProperty() token!: string;
  @ApiProperty() newPassword!: string;
}

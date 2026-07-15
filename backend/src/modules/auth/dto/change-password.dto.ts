import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import { PASSWORD_REGEX, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_POLICY_MESSAGE } from './password.constants';

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH)
      .max(PASSWORD_MAX_LENGTH)
      .regex(PASSWORD_REGEX, PASSWORD_POLICY_MESSAGE),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'New password must differ from the current password',
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export class ChangePasswordDto implements ChangePasswordInput {
  @ApiProperty() currentPassword!: string;
  @ApiProperty() newPassword!: string;
}

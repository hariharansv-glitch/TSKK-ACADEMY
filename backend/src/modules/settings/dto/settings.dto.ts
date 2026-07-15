import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export const updateSettingsSchema = z.object({
  workingHoursJson: z.record(z.unknown()).optional(),
  autoLateFeeEnabled: z.coerce.boolean().optional(),
  autoReceiptEnabled: z.coerce.boolean().optional(),
  autoAttendanceReminderEnabled: z.coerce.boolean().optional(),
  autoFeeReminderEnabled: z.coerce.boolean().optional(),
  birthdayWishesEnabled: z.coerce.boolean().optional(),
  defaultTaxPercent: z.coerce.number().int().min(0).max(50).optional(),
  invoicePrefix: z.string().trim().min(1).max(10).optional(),
  receiptPrefix: z.string().trim().min(1).max(10).optional(),
  certificatePrefix: z.string().trim().min(1).max(10).optional(),
  studentCodePrefix: z.string().trim().min(1).max(10).optional(),
  employeeCodePrefix: z.string().trim().min(1).max(10).optional(),
  qrCheckInWindowMinutes: z.coerce.number().int().min(1).max(240).optional(),
  attendanceLateAfterMinutes: z.coerce.number().int().min(0).max(240).optional(),
  smsEnabled: z.coerce.boolean().optional(),
  whatsappEnabled: z.coerce.boolean().optional(),
  emailEnabled: z.coerce.boolean().optional(),
  pushEnabled: z.coerce.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export class UpdateSettingsDto {
  @ApiPropertyOptional() workingHoursJson?: Record<string, unknown>;
  @ApiPropertyOptional() autoLateFeeEnabled?: boolean;
  @ApiPropertyOptional() autoReceiptEnabled?: boolean;
  @ApiPropertyOptional() autoAttendanceReminderEnabled?: boolean;
  @ApiPropertyOptional() autoFeeReminderEnabled?: boolean;
  @ApiPropertyOptional() birthdayWishesEnabled?: boolean;
  @ApiPropertyOptional() defaultTaxPercent?: number;
  @ApiPropertyOptional() invoicePrefix?: string;
  @ApiPropertyOptional() receiptPrefix?: string;
  @ApiPropertyOptional() certificatePrefix?: string;
  @ApiPropertyOptional() studentCodePrefix?: string;
  @ApiPropertyOptional() employeeCodePrefix?: string;
  @ApiPropertyOptional() qrCheckInWindowMinutes?: number;
  @ApiPropertyOptional() attendanceLateAfterMinutes?: number;
  @ApiPropertyOptional() smsEnabled?: boolean;
  @ApiPropertyOptional() whatsappEnabled?: boolean;
  @ApiPropertyOptional() emailEnabled?: boolean;
  @ApiPropertyOptional() pushEnabled?: boolean;
  @ApiPropertyOptional() metadata?: Record<string, unknown>;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { z } from 'zod';

export const updateSubscriptionSchema = z.object({
  plan: z.nativeEnum(SubscriptionPlan).optional(),
  status: z.nativeEnum(SubscriptionStatus).optional(),
  seatLimit: z.coerce.number().int().min(1).max(100_000).optional(),
  pricePaise: z.coerce.number().int().min(0).optional(),
  currentPeriodEnd: z.coerce.date().optional(),
  cancelAt: z.coerce.date().nullable().optional(),
});
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

export class UpdateSubscriptionDto implements UpdateSubscriptionInput {
  @ApiPropertyOptional({ enum: SubscriptionPlan }) plan?: SubscriptionPlan;
  @ApiPropertyOptional({ enum: SubscriptionStatus }) status?: SubscriptionStatus;
  @ApiPropertyOptional() seatLimit?: number;
  @ApiPropertyOptional() pricePaise?: number;
  @ApiPropertyOptional() currentPeriodEnd?: Date;
  @ApiPropertyOptional() cancelAt?: Date | null;
}

export const suspendAcademySchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
});
export class SuspendAcademyDto {
  @ApiProperty({ required: false }) reason?: string;
}

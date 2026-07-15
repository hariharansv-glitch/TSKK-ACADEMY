import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeeStatus, FeeType } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const createFeePlanSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  type: z.nativeEnum(FeeType),
  amountPaise: z.coerce.number().int().min(0).max(1_000_000_000),
  currency: z.string().trim().length(3).optional().default('INR'),
  billingCycleMonths: z.coerce.number().int().min(0).max(60).default(1),
  gracePeriodDays: z.coerce.number().int().min(0).max(365).default(7),
  lateFeePaise: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  isActive: z.coerce.boolean().optional().default(true),
});
export type CreateFeePlanInput = z.infer<typeof createFeePlanSchema>;
export class CreateFeePlanDto {
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty({ enum: FeeType }) type!: FeeType;
  @ApiProperty() amountPaise!: number;
  @ApiPropertyOptional({ default: 'INR' }) currency: string = 'INR';
  @ApiPropertyOptional({ default: 1 }) billingCycleMonths: number = 1;
  @ApiPropertyOptional({ default: 7 }) gracePeriodDays: number = 7;
  @ApiPropertyOptional({ default: 0 }) lateFeePaise: number = 0;
  @ApiPropertyOptional({ default: true }) isActive: boolean = true;
}

export const updateFeePlanSchema = createFeePlanSchema.partial();
export type UpdateFeePlanInput = z.infer<typeof updateFeePlanSchema>;
export class UpdateFeePlanDto {
  @ApiPropertyOptional() name?: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional({ enum: FeeType }) type?: FeeType;
  @ApiPropertyOptional() amountPaise?: number;
  @ApiPropertyOptional() currency?: string;
  @ApiPropertyOptional() billingCycleMonths?: number;
  @ApiPropertyOptional() gracePeriodDays?: number;
  @ApiPropertyOptional() lateFeePaise?: number;
  @ApiPropertyOptional() isActive?: boolean;
}

export const createInvoiceSchema = z.object({
  studentId: z.string().trim().min(1).max(48),
  feePlanId: z.string().trim().min(1).max(48).optional(),
  type: z.nativeEnum(FeeType),
  amountPaise: z.coerce.number().int().min(0),
  discountPaise: z.coerce.number().int().min(0).optional().default(0),
  taxPaise: z.coerce.number().int().min(0).optional().default(0),
  scholarshipReason: z.string().trim().max(500).optional(),
  dueDate: z.coerce.date(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export class CreateInvoiceDto {
  @ApiProperty() studentId!: string;
  @ApiPropertyOptional() feePlanId?: string;
  @ApiProperty({ enum: FeeType }) type!: FeeType;
  @ApiProperty() amountPaise!: number;
  @ApiPropertyOptional({ default: 0 }) discountPaise?: number = 0;
  @ApiPropertyOptional({ default: 0 }) taxPaise?: number = 0;
  @ApiPropertyOptional() scholarshipReason?: string;
  @ApiProperty({ type: String, format: 'date' }) dueDate!: Date;
  @ApiPropertyOptional() periodStart?: Date;
  @ApiPropertyOptional() periodEnd?: Date;
  @ApiPropertyOptional() notes?: string;
}

export const updateInvoiceSchema = z.object({
  amountPaise: z.coerce.number().int().min(0).optional(),
  discountPaise: z.coerce.number().int().min(0).optional(),
  taxPaise: z.coerce.number().int().min(0).optional(),
  lateFeePaise: z.coerce.number().int().min(0).optional(),
  dueDate: z.coerce.date().optional(),
  status: z.nativeEnum(FeeStatus).optional(),
  scholarshipReason: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export class UpdateInvoiceDto {
  @ApiPropertyOptional() amountPaise?: number;
  @ApiPropertyOptional() discountPaise?: number;
  @ApiPropertyOptional() taxPaise?: number;
  @ApiPropertyOptional() lateFeePaise?: number;
  @ApiPropertyOptional() dueDate?: Date;
  @ApiPropertyOptional({ enum: FeeStatus }) status?: FeeStatus;
  @ApiPropertyOptional() scholarshipReason?: string | null;
  @ApiPropertyOptional() notes?: string | null;
}

export const listInvoicesSchema = paginationQuerySchema.extend({
  studentId: z.string().trim().min(1).max(48).optional(),
  status: z.nativeEnum(FeeStatus).optional(),
  type: z.nativeEnum(FeeType).optional(),
  overdue: z.coerce.boolean().optional(),
});
export type ListInvoicesQuery = z.infer<typeof listInvoicesSchema>;
export class ListInvoicesQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional() studentId?: string;
  @ApiPropertyOptional({ enum: FeeStatus }) status?: FeeStatus;
  @ApiPropertyOptional({ enum: FeeType }) type?: FeeType;
  @ApiPropertyOptional() overdue?: boolean;
}

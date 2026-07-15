import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const recordPaymentSchema = z.object({
  invoiceId: z.string().trim().min(1).max(48),
  amountPaise: z.coerce.number().int().min(1),
  method: z.nativeEnum(PaymentMethod),
  paidAt: z.coerce.date().optional(),
  reference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export class RecordPaymentDto {
  @ApiProperty() invoiceId!: string;
  @ApiProperty() amountPaise!: number;
  @ApiProperty({ enum: PaymentMethod }) method!: PaymentMethod;
  @ApiPropertyOptional() paidAt?: Date;
  @ApiPropertyOptional() reference?: string;
  @ApiPropertyOptional() notes?: string;
}

export const initiateRazorpaySchema = z.object({
  invoiceId: z.string().trim().min(1).max(48),
});
export type InitiateRazorpayInput = z.infer<typeof initiateRazorpaySchema>;
export class InitiateRazorpayDto {
  @ApiProperty() invoiceId!: string;
}

export const verifyRazorpaySchema = z.object({
  invoiceId: z.string().trim().min(1).max(48),
  razorpayOrderId: z.string().trim().min(1).max(200),
  razorpayPaymentId: z.string().trim().min(1).max(200),
  razorpaySignature: z.string().trim().min(1).max(500),
});
export type VerifyRazorpayInput = z.infer<typeof verifyRazorpaySchema>;
export class VerifyRazorpayDto {
  @ApiProperty() invoiceId!: string;
  @ApiProperty() razorpayOrderId!: string;
  @ApiProperty() razorpayPaymentId!: string;
  @ApiProperty() razorpaySignature!: string;
}

export const refundPaymentSchema = z.object({
  amountPaise: z.coerce.number().int().min(1).optional(),
  reason: z.string().trim().max(500).optional(),
});
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
export class RefundPaymentDto {
  @ApiPropertyOptional() amountPaise?: number;
  @ApiPropertyOptional() reason?: string;
}

export const listPaymentsSchema = paginationQuerySchema.extend({
  studentId: z.string().trim().min(1).max(48).optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListPaymentsQuery = z.infer<typeof listPaymentsSchema>;
export class ListPaymentsQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional() studentId?: string;
  @ApiPropertyOptional({ enum: PaymentMethod }) method?: PaymentMethod;
  @ApiPropertyOptional({ enum: PaymentStatus }) status?: PaymentStatus;
  @ApiPropertyOptional() from?: Date;
  @ApiPropertyOptional() to?: Date;
}

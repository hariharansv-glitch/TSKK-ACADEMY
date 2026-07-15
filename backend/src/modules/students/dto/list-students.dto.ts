import { ApiPropertyOptional } from '@nestjs/swagger';
import { BeltLevel, StudentStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const listStudentsSchema = paginationQuerySchema.extend({
  status: z.nativeEnum(StudentStatus).optional(),
  belt: z.nativeEnum(BeltLevel).optional(),
  branchId: z.string().trim().min(1).max(48).optional(),
  batchId: z.string().trim().min(1).max(48).optional(),
  admittedFrom: z.coerce.date().optional(),
  admittedTo: z.coerce.date().optional(),
});
export type ListStudentsQuery = z.infer<typeof listStudentsSchema>;

export class ListStudentsQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional({ enum: StudentStatus }) status?: StudentStatus;
  @ApiPropertyOptional({ enum: BeltLevel }) belt?: BeltLevel;
  @ApiPropertyOptional() branchId?: string;
  @ApiPropertyOptional() batchId?: string;
  @ApiPropertyOptional() admittedFrom?: Date;
  @ApiPropertyOptional() admittedTo?: Date;
}

export const historyEntrySchema = z.object({
  eventType: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  data: z.record(z.unknown()).optional(),
  occurredAt: z.coerce.date().optional(),
});
export type HistoryEntryInput = z.infer<typeof historyEntrySchema>;

export class HistoryEntryDto {
  @ApiPropertyOptional() eventType!: string;
  @ApiPropertyOptional() title!: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() data?: Record<string, unknown>;
  @ApiPropertyOptional() occurredAt?: Date;
}

export const assignBatchSchema = z.object({
  batchId: z.string().trim().min(1).max(48),
});
export type AssignBatchInput = z.infer<typeof assignBatchSchema>;

export class AssignBatchDto {
  @ApiPropertyOptional() batchId!: string;
}

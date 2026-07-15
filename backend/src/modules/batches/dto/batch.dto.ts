import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

// Weekly schedule: for each weekday (0=Sun..6=Sat) an optional { start: "HH:mm", end: "HH:mm" }
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm required');
export const scheduleSlotSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  start: timeString,
  end: timeString,
});
export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;

export const createBatchSchema = z.object({
  classId: z.string().trim().min(1).max(48),
  branchId: z.string().trim().min(1).max(48).optional(),
  instructorId: z.string().trim().min(1).max(48).optional(),
  name: z.string().trim().min(1).max(120),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  capacity: z.coerce.number().int().min(1).max(500).optional().default(30),
  schedule: z.array(scheduleSlotSchema).min(1),
  isActive: z.coerce.boolean().optional().default(true),
});
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export class CreateBatchDto {
  @ApiProperty() classId!: string;
  @ApiPropertyOptional() branchId?: string;
  @ApiPropertyOptional() instructorId?: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, format: 'date' }) startDate!: Date;
  @ApiPropertyOptional({ type: String, format: 'date' }) endDate?: Date;
  @ApiPropertyOptional({ default: 30 }) capacity?: number;
  @ApiProperty({ type: [Object] }) schedule!: ScheduleSlot[];
  @ApiPropertyOptional({ default: true }) isActive?: boolean;
}

export const updateBatchSchema = createBatchSchema.partial();
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export class UpdateBatchDto extends CreateBatchDto {}

export const listBatchesSchema = paginationQuerySchema.extend({
  classId: z.string().trim().min(1).max(48).optional(),
  branchId: z.string().trim().min(1).max(48).optional(),
  instructorId: z.string().trim().min(1).max(48).optional(),
  isActive: z.coerce.boolean().optional(),
});
export type ListBatchesQuery = z.infer<typeof listBatchesSchema>;
export class ListBatchesQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() classId?: string;
  @ApiPropertyOptional() branchId?: string;
  @ApiPropertyOptional() instructorId?: string;
  @ApiPropertyOptional() isActive?: boolean;
}

export const enrollStudentSchema = z.object({
  studentId: z.string().trim().min(1).max(48),
});
export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;
export class EnrollStudentDto {
  @ApiProperty() studentId!: string;
}

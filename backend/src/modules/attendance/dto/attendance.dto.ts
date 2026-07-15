import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceMethod, AttendanceStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const scanQrSchema = z.object({
  payload: z.string().min(10).max(512),
  batchId: z.string().trim().min(1).max(48).optional(),
  checkInAt: z.coerce.date().optional(),
});
export type ScanQrInput = z.infer<typeof scanQrSchema>;
export class ScanQrDto {
  @ApiProperty() payload!: string;
  @ApiPropertyOptional() batchId?: string;
  @ApiPropertyOptional() checkInAt?: Date;
}

export const markAttendanceSchema = z.object({
  studentId: z.string().trim().min(1).max(48),
  batchId: z.string().trim().min(1).max(48).optional(),
  date: z.coerce.date(),
  status: z.nativeEnum(AttendanceStatus),
  method: z.nativeEnum(AttendanceMethod).optional().default(AttendanceMethod.MANUAL),
  checkInAt: z.coerce.date().optional(),
  checkOutAt: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional(),
});
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export class MarkAttendanceDto {
  @ApiProperty() studentId!: string;
  @ApiPropertyOptional() batchId?: string;
  @ApiProperty({ type: String, format: 'date' }) date!: Date;
  @ApiProperty({ enum: AttendanceStatus }) status!: AttendanceStatus;
  @ApiPropertyOptional({ enum: AttendanceMethod }) method?: AttendanceMethod;
  @ApiPropertyOptional() checkInAt?: Date;
  @ApiPropertyOptional() checkOutAt?: Date;
  @ApiPropertyOptional() notes?: string;
}

export const bulkMarkSchema = z.object({
  batchId: z.string().trim().min(1).max(48),
  date: z.coerce.date(),
  method: z.nativeEnum(AttendanceMethod).optional().default(AttendanceMethod.MANUAL),
  entries: z
    .array(
      z.object({
        studentId: z.string().trim().min(1).max(48),
        status: z.nativeEnum(AttendanceStatus),
        notes: z.string().trim().max(500).optional(),
      }),
    )
    .min(1)
    .max(500),
});
export type BulkMarkInput = z.infer<typeof bulkMarkSchema>;
export class BulkMarkDto {
  @ApiProperty() batchId!: string;
  @ApiProperty({ type: String, format: 'date' }) date!: Date;
  @ApiPropertyOptional({ enum: AttendanceMethod }) method?: AttendanceMethod;
  @ApiProperty({ type: [Object] }) entries!: Array<{ studentId: string; status: AttendanceStatus; notes?: string }>;
}

export const listAttendanceSchema = paginationQuerySchema.extend({
  studentId: z.string().trim().min(1).max(48).optional(),
  batchId: z.string().trim().min(1).max(48).optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListAttendanceQuery = z.infer<typeof listAttendanceSchema>;
export class ListAttendanceQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional() studentId?: string;
  @ApiPropertyOptional() batchId?: string;
  @ApiPropertyOptional({ enum: AttendanceStatus }) status?: AttendanceStatus;
  @ApiPropertyOptional() from?: Date;
  @ApiPropertyOptional() to?: Date;
}

export const createHolidaySchema = z.object({
  name: z.string().trim().min(1).max(120),
  date: z.coerce.date(),
  isRecurring: z.coerce.boolean().optional().default(false),
  description: z.string().trim().max(500).optional(),
});
export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export class CreateHolidayDto {
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, format: 'date' }) date!: Date;
  @ApiPropertyOptional({ default: false }) isRecurring?: boolean = false;
  @ApiPropertyOptional() description?: string;
}

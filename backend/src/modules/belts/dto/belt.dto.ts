import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BeltLevel, ExamResult } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const scheduleBeltExamSchema = z.object({
  studentId: z.string().trim().min(1).max(48),
  evaluatorId: z.string().trim().min(1).max(48).optional(),
  fromBelt: z.nativeEnum(BeltLevel),
  toBelt: z.nativeEnum(BeltLevel),
  examDate: z.coerce.date(),
  location: z.string().trim().max(200).optional(),
  maxMarks: z.coerce.number().int().min(1).max(1000).optional().default(100),
  remarks: z.string().trim().max(2000).optional(),
});
export type ScheduleBeltExamInput = z.infer<typeof scheduleBeltExamSchema>;
export class ScheduleBeltExamDto {
  @ApiProperty() studentId!: string;
  @ApiPropertyOptional() evaluatorId?: string;
  @ApiProperty({ enum: BeltLevel }) fromBelt!: BeltLevel;
  @ApiProperty({ enum: BeltLevel }) toBelt!: BeltLevel;
  @ApiProperty({ type: String, format: 'date-time' }) examDate!: Date;
  @ApiPropertyOptional() location?: string;
  @ApiPropertyOptional({ default: 100 }) maxMarks?: number = 100;
  @ApiPropertyOptional() remarks?: string;
}

export const gradeBeltExamSchema = z.object({
  technicalMarks: z.coerce.number().int().min(0).max(1000).optional(),
  physicalMarks: z.coerce.number().int().min(0).max(1000).optional(),
  disciplineMarks: z.coerce.number().int().min(0).max(1000).optional(),
  totalMarks: z.coerce.number().int().min(0).max(3000).optional(),
  result: z.nativeEnum(ExamResult),
  remarks: z.string().trim().max(2000).optional(),
  issueCertificate: z.coerce.boolean().optional().default(true),
});
export type GradeBeltExamInput = z.infer<typeof gradeBeltExamSchema>;
export class GradeBeltExamDto {
  @ApiPropertyOptional() technicalMarks?: number;
  @ApiPropertyOptional() physicalMarks?: number;
  @ApiPropertyOptional() disciplineMarks?: number;
  @ApiPropertyOptional() totalMarks?: number;
  @ApiProperty({ enum: ExamResult }) result!: ExamResult;
  @ApiPropertyOptional() remarks?: string;
  @ApiPropertyOptional({ default: true }) issueCertificate?: boolean = true;
}

export const listBeltExamsSchema = paginationQuerySchema.extend({
  studentId: z.string().trim().min(1).max(48).optional(),
  result: z.nativeEnum(ExamResult).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});
export type ListBeltExamsQuery = z.infer<typeof listBeltExamsSchema>;
export class ListBeltExamsQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional() studentId?: string;
  @ApiPropertyOptional({ enum: ExamResult }) result?: ExamResult;
  @ApiPropertyOptional() fromDate?: Date;
  @ApiPropertyOptional() toDate?: Date;
}

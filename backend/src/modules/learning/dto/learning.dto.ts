import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BeltLevel } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

// ── Videos ────────────────────────────────────────────────────────────────
export const createVideoSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  instructorId: z.string().trim().min(1).max(48).optional(),
  durationSeconds: z.coerce.number().int().min(1).max(60 * 60 * 24).optional(),
  minBelt: z.nativeEnum(BeltLevel).optional().default(BeltLevel.WHITE),
  category: z.string().trim().max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  isPublished: z.coerce.boolean().optional().default(false),
});
export type CreateVideoInput = z.infer<typeof createVideoSchema>;
export class CreateVideoDto {
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() url!: string;
  @ApiPropertyOptional() thumbnailUrl?: string;
  @ApiPropertyOptional() instructorId?: string;
  @ApiPropertyOptional() durationSeconds?: number;
  @ApiPropertyOptional({ enum: BeltLevel }) minBelt?: BeltLevel;
  @ApiPropertyOptional() category?: string;
  @ApiPropertyOptional({ type: [String] }) tags?: string[];
  @ApiPropertyOptional({ default: false }) isPublished?: boolean;
}

export const updateVideoSchema = createVideoSchema.partial();
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;
export class UpdateVideoDto extends CreateVideoDto {}

export const listVideosSchema = paginationQuerySchema.extend({
  minBelt: z.nativeEnum(BeltLevel).optional(),
  category: z.string().trim().max(80).optional(),
  publishedOnly: z.coerce.boolean().optional().default(true),
  instructorId: z.string().trim().min(1).max(48).optional(),
});
export type ListVideosQuery = z.infer<typeof listVideosSchema>;
export class ListVideosQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional({ enum: BeltLevel }) minBelt?: BeltLevel;
  @ApiPropertyOptional() category?: string;
  @ApiPropertyOptional({ default: true }) publishedOnly?: boolean;
  @ApiPropertyOptional() instructorId?: string;
}

// ── Documents ─────────────────────────────────────────────────────────────
export const createDocumentSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  url: z.string().url(),
  category: z.string().trim().max(80).optional(),
  minBelt: z.nativeEnum(BeltLevel).optional().default(BeltLevel.WHITE),
  fileSizeBytes: z.coerce.number().int().min(1).optional(),
  mimeType: z.string().trim().max(120).optional(),
  isPublished: z.coerce.boolean().optional().default(false),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export class CreateDocumentDto {
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() url!: string;
  @ApiPropertyOptional() category?: string;
  @ApiPropertyOptional({ enum: BeltLevel }) minBelt?: BeltLevel;
  @ApiPropertyOptional() fileSizeBytes?: number;
  @ApiPropertyOptional() mimeType?: string;
  @ApiPropertyOptional({ default: false }) isPublished?: boolean;
}

export const updateDocumentSchema = createDocumentSchema.partial();
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export class UpdateDocumentDto extends CreateDocumentDto {}

export const listDocumentsSchema = paginationQuerySchema.extend({
  minBelt: z.nativeEnum(BeltLevel).optional(),
  category: z.string().trim().max(80).optional(),
  publishedOnly: z.coerce.boolean().optional().default(true),
});
export type ListDocumentsQuery = z.infer<typeof listDocumentsSchema>;
export class ListDocumentsQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional({ enum: BeltLevel }) minBelt?: BeltLevel;
  @ApiPropertyOptional() category?: string;
  @ApiPropertyOptional({ default: true }) publishedOnly?: boolean;
}

// ── Assignments ───────────────────────────────────────────────────────────
export const createAssignmentSchema = z.object({
  batchId: z.string().trim().min(1).max(48),
  instructorId: z.string().trim().min(1).max(48),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(1).max(5000),
  dueAt: z.coerce.date(),
  maxMarks: z.coerce.number().int().min(1).max(1000).optional().default(100),
  attachments: z.array(z.string().url()).max(10).optional().default([]),
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export class CreateAssignmentDto {
  @ApiProperty() batchId!: string;
  @ApiProperty() instructorId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: String, format: 'date-time' }) dueAt!: Date;
  @ApiPropertyOptional({ default: 100 }) maxMarks?: number;
  @ApiPropertyOptional({ type: [String] }) attachments?: string[];
}

export const submitAssignmentSchema = z.object({
  studentId: z.string().trim().min(1).max(48),
  content: z.string().trim().max(20_000).optional(),
  attachments: z.array(z.string().url()).max(10).optional().default([]),
});
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;
export class SubmitAssignmentDto {
  @ApiProperty() studentId!: string;
  @ApiPropertyOptional() content?: string;
  @ApiPropertyOptional({ type: [String] }) attachments?: string[];
}

export const gradeSubmissionSchema = z.object({
  marks: z.coerce.number().int().min(0),
  feedback: z.string().trim().max(2000).optional(),
});
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
export class GradeSubmissionDto {
  @ApiProperty() marks!: number;
  @ApiPropertyOptional() feedback?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BeltLevel } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const createClassSchema = z.object({
  branchId: z.string().trim().min(1).max(48).optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  minBelt: z.nativeEnum(BeltLevel).optional().default(BeltLevel.WHITE),
  maxBelt: z.nativeEnum(BeltLevel).optional().default(BeltLevel.BLACK_5),
  minAge: z.coerce.number().int().min(3).max(100).optional(),
  maxAge: z.coerce.number().int().min(3).max(100).optional(),
  capacity: z.coerce.number().int().min(1).max(500).optional().default(30),
  primaryInstructorId: z.string().trim().min(1).max(48).optional(),
  isActive: z.coerce.boolean().optional().default(true),
});
export type CreateClassInput = z.infer<typeof createClassSchema>;
export class CreateClassDto {
  @ApiPropertyOptional() branchId?: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional({ enum: BeltLevel }) minBelt?: BeltLevel;
  @ApiPropertyOptional({ enum: BeltLevel }) maxBelt?: BeltLevel;
  @ApiPropertyOptional() minAge?: number;
  @ApiPropertyOptional() maxAge?: number;
  @ApiPropertyOptional({ default: 30 }) capacity?: number;
  @ApiPropertyOptional() primaryInstructorId?: string;
  @ApiPropertyOptional({ default: true }) isActive?: boolean;
}

export const updateClassSchema = createClassSchema.partial();
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export class UpdateClassDto extends CreateClassDto {}

export const listClassesSchema = paginationQuerySchema.extend({
  branchId: z.string().trim().min(1).max(48).optional(),
  isActive: z.coerce.boolean().optional(),
});
export type ListClassesQuery = z.infer<typeof listClassesSchema>;
export class ListClassesQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() branchId?: string;
  @ApiPropertyOptional() isActive?: boolean;
}

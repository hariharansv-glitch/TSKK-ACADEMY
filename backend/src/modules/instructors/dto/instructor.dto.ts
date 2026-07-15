import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BeltLevel, Gender } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const createInstructorSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(6).max(20),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.nativeEnum(Gender).optional(),
  currentBelt: z.nativeEnum(BeltLevel).optional().default(BeltLevel.BLACK_1),
  yearsExperience: z.coerce.number().int().min(0).max(80).optional().default(0),
  qualifications: z.string().trim().max(500).optional(),
  specializations: z.string().trim().max(500).optional(),
  bio: z.string().trim().max(2000).optional(),
  joinedAt: z.coerce.date().optional(),
  isActive: z.coerce.boolean().optional().default(true),
  salaryPaise: z.coerce.number().int().min(0).max(1_000_000_000).optional().default(0),
  bankName: z.string().trim().max(120).optional(),
  bankAccountNumber: z.string().trim().max(32).optional(),
  bankIfsc: z.string().trim().max(16).optional(),
  panNumber: z.string().trim().max(16).optional(),
  aadhaarNumber: z.string().trim().max(16).optional(),
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: z.string().trim().min(6).max(20).optional(),
  addressLine1: z.string().trim().max(160).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(16).optional(),
  createUserAccount: z.coerce.boolean().optional().default(true),
});
export type CreateInstructorInput = z.infer<typeof createInstructorSchema>;

export class CreateInstructorDto {
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() email!: string;
  @ApiProperty() phone!: string;
  @ApiPropertyOptional() dateOfBirth?: Date;
  @ApiPropertyOptional({ enum: Gender }) gender?: Gender;
  @ApiPropertyOptional({ enum: BeltLevel }) currentBelt?: BeltLevel;
  @ApiPropertyOptional() yearsExperience?: number;
  @ApiPropertyOptional() qualifications?: string;
  @ApiPropertyOptional() specializations?: string;
  @ApiPropertyOptional() bio?: string;
  @ApiPropertyOptional() joinedAt?: Date;
  @ApiPropertyOptional({ default: true }) isActive: boolean = true;
  @ApiPropertyOptional() salaryPaise?: number;
  @ApiPropertyOptional() bankName?: string;
  @ApiPropertyOptional() bankAccountNumber?: string;
  @ApiPropertyOptional() bankIfsc?: string;
  @ApiPropertyOptional() panNumber?: string;
  @ApiPropertyOptional() aadhaarNumber?: string;
  @ApiPropertyOptional() emergencyContactName?: string;
  @ApiPropertyOptional() emergencyContactPhone?: string;
  @ApiPropertyOptional() addressLine1?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() state?: string;
  @ApiPropertyOptional() postalCode?: string;
  @ApiPropertyOptional({ default: true }) createUserAccount: boolean = true;
}

export const updateInstructorSchema = createInstructorSchema
  .omit({ createUserAccount: true })
  .partial();
export type UpdateInstructorInput = z.infer<typeof updateInstructorSchema>;
export class UpdateInstructorDto {
  @ApiPropertyOptional() firstName?: string;
  @ApiPropertyOptional() lastName?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() dateOfBirth?: Date;
  @ApiPropertyOptional({ enum: Gender }) gender?: Gender;
  @ApiPropertyOptional({ enum: BeltLevel }) currentBelt?: BeltLevel;
  @ApiPropertyOptional() yearsExperience?: number;
  @ApiPropertyOptional() qualifications?: string;
  @ApiPropertyOptional() specializations?: string;
  @ApiPropertyOptional() bio?: string;
  @ApiPropertyOptional() joinedAt?: Date;
  @ApiPropertyOptional() isActive?: boolean;
  @ApiPropertyOptional() salaryPaise?: number;
  @ApiPropertyOptional() bankName?: string;
  @ApiPropertyOptional() bankAccountNumber?: string;
  @ApiPropertyOptional() bankIfsc?: string;
  @ApiPropertyOptional() panNumber?: string;
  @ApiPropertyOptional() aadhaarNumber?: string;
  @ApiPropertyOptional() emergencyContactName?: string;
  @ApiPropertyOptional() emergencyContactPhone?: string;
  @ApiPropertyOptional() addressLine1?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() state?: string;
  @ApiPropertyOptional() postalCode?: string;
}

export const listInstructorsSchema = paginationQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
  belt: z.nativeEnum(BeltLevel).optional(),
});
export type ListInstructorsQuery = z.infer<typeof listInstructorsSchema>;
export class ListInstructorsQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional() isActive?: boolean;
  @ApiPropertyOptional({ enum: BeltLevel }) belt?: BeltLevel;
}

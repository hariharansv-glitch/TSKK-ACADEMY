import { ApiPropertyOptional } from '@nestjs/swagger';
import { BeltLevel, Gender, StudentStatus } from '@prisma/client';
import { z } from 'zod';

export const updateStudentSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.nativeEnum(Gender).optional(),
  bloodGroup: z.string().trim().max(8).nullable().optional(),
  branchId: z.string().trim().min(1).max(48).nullable().optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  currentBelt: z.nativeEnum(BeltLevel).optional(),
  currentBeltSince: z.coerce.date().nullable().optional(),
  email: z.string().trim().toLowerCase().email().max(254).nullable().optional(),
  phone: z.string().trim().min(6).max(20).nullable().optional(),
  addressLine1: z.string().trim().max(160).nullable().optional(),
  addressLine2: z.string().trim().max(160).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  state: z.string().trim().max(80).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  postalCode: z.string().trim().max(16).nullable().optional(),
  schoolName: z.string().trim().max(160).nullable().optional(),
  schoolClass: z.string().trim().max(24).nullable().optional(),
  hobbies: z.string().trim().max(500).nullable().optional(),
  languages: z.string().trim().max(200).nullable().optional(),
  medicalConditions: z.string().trim().max(1000).nullable().optional(),
  allergies: z.string().trim().max(1000).nullable().optional(),
  medications: z.string().trim().max(1000).nullable().optional(),
  bloodPressure: z.string().trim().max(32).nullable().optional(),
  heightCm: z.coerce.number().int().min(30).max(250).nullable().optional(),
  weightKg: z.coerce.number().int().min(5).max(300).nullable().optional(),
  emergencyContactName: z.string().trim().max(120).nullable().optional(),
  emergencyContactPhone: z.string().trim().min(6).max(20).nullable().optional(),
  emergencyContactRelation: z.string().trim().max(48).nullable().optional(),
  guardianName: z.string().trim().max(120).nullable().optional(),
  guardianPhone: z.string().trim().min(6).max(20).nullable().optional(),
  guardianEmail: z.string().trim().toLowerCase().email().max(254).nullable().optional(),
  guardianOccupation: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export class UpdateStudentDto {
  @ApiPropertyOptional() firstName?: string;
  @ApiPropertyOptional() lastName?: string;
  @ApiPropertyOptional() dateOfBirth?: Date;
  @ApiPropertyOptional({ enum: Gender }) gender?: Gender;
  @ApiPropertyOptional() bloodGroup?: string | null;
  @ApiPropertyOptional() branchId?: string | null;
  @ApiPropertyOptional({ enum: StudentStatus }) status?: StudentStatus;
  @ApiPropertyOptional({ enum: BeltLevel }) currentBelt?: BeltLevel;
  @ApiPropertyOptional() currentBeltSince?: Date | null;
  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional() addressLine1?: string | null;
  @ApiPropertyOptional() addressLine2?: string | null;
  @ApiPropertyOptional() city?: string | null;
  @ApiPropertyOptional() state?: string | null;
  @ApiPropertyOptional() country?: string | null;
  @ApiPropertyOptional() postalCode?: string | null;
  @ApiPropertyOptional() schoolName?: string | null;
  @ApiPropertyOptional() schoolClass?: string | null;
  @ApiPropertyOptional() hobbies?: string | null;
  @ApiPropertyOptional() languages?: string | null;
  @ApiPropertyOptional() medicalConditions?: string | null;
  @ApiPropertyOptional() allergies?: string | null;
  @ApiPropertyOptional() medications?: string | null;
  @ApiPropertyOptional() bloodPressure?: string | null;
  @ApiPropertyOptional() heightCm?: number | null;
  @ApiPropertyOptional() weightKg?: number | null;
  @ApiPropertyOptional() emergencyContactName?: string | null;
  @ApiPropertyOptional() emergencyContactPhone?: string | null;
  @ApiPropertyOptional() emergencyContactRelation?: string | null;
  @ApiPropertyOptional() guardianName?: string | null;
  @ApiPropertyOptional() guardianPhone?: string | null;
  @ApiPropertyOptional() guardianEmail?: string | null;
  @ApiPropertyOptional() guardianOccupation?: string | null;
  @ApiPropertyOptional() notes?: string | null;
}

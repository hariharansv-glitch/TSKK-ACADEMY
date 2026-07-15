import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BeltLevel, Gender, StudentStatus } from '@prisma/client';
import { z } from 'zod';

const MIN_AGE_YEARS = 3;
const MAX_AGE_YEARS = 90;

export const createStudentSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    dateOfBirth: z.coerce.date(),
    gender: z.nativeEnum(Gender),
    bloodGroup: z.string().trim().max(8).optional(),

    branchId: z.string().trim().min(1).max(48).optional(),
    admissionDate: z.coerce.date().optional(),
    status: z.nativeEnum(StudentStatus).optional().default(StudentStatus.ACTIVE),
    currentBelt: z.nativeEnum(BeltLevel).optional().default(BeltLevel.WHITE),
    currentBeltSince: z.coerce.date().optional(),

    email: z.string().trim().toLowerCase().email().max(254).optional(),
    phone: z.string().trim().min(6).max(20).optional(),

    addressLine1: z.string().trim().max(160).optional(),
    addressLine2: z.string().trim().max(160).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    country: z.string().trim().max(80).optional().default('India'),
    postalCode: z.string().trim().max(16).optional(),

    schoolName: z.string().trim().max(160).optional(),
    schoolClass: z.string().trim().max(24).optional(),
    hobbies: z.string().trim().max(500).optional(),
    languages: z.string().trim().max(200).optional(),

    medicalConditions: z.string().trim().max(1000).optional(),
    allergies: z.string().trim().max(1000).optional(),
    medications: z.string().trim().max(1000).optional(),
    bloodPressure: z.string().trim().max(32).optional(),
    heightCm: z.coerce.number().int().min(30).max(250).optional(),
    weightKg: z.coerce.number().int().min(5).max(300).optional(),

    emergencyContactName: z.string().trim().max(120).optional(),
    emergencyContactPhone: z.string().trim().min(6).max(20).optional(),
    emergencyContactRelation: z.string().trim().max(48).optional(),

    guardianName: z.string().trim().max(120).optional(),
    guardianPhone: z.string().trim().min(6).max(20).optional(),
    guardianEmail: z.string().trim().toLowerCase().email().max(254).optional(),
    guardianOccupation: z.string().trim().max(120).optional(),

    parentId: z.string().trim().min(1).max(48).optional(),
    batchIds: z.array(z.string().trim().min(1).max(48)).optional(),

    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    const now = new Date();
    if (v.dateOfBirth > now) {
      ctx.addIssue({ path: ['dateOfBirth'], code: z.ZodIssueCode.custom, message: 'Date of birth cannot be in the future' });
    }
    const ageYears = (now.getTime() - v.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < MIN_AGE_YEARS) {
      ctx.addIssue({ path: ['dateOfBirth'], code: z.ZodIssueCode.custom, message: `Student must be at least ${MIN_AGE_YEARS} years old` });
    }
    if (ageYears > MAX_AGE_YEARS) {
      ctx.addIssue({ path: ['dateOfBirth'], code: z.ZodIssueCode.custom, message: `Student cannot be older than ${MAX_AGE_YEARS} years` });
    }
    if (v.admissionDate && v.admissionDate > now) {
      ctx.addIssue({ path: ['admissionDate'], code: z.ZodIssueCode.custom, message: 'Admission date cannot be in the future' });
    }
  });

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export class CreateStudentDto implements CreateStudentInput {
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ type: String, format: 'date' }) dateOfBirth!: Date;
  @ApiProperty({ enum: Gender }) gender!: Gender;
  @ApiPropertyOptional() bloodGroup?: string;
  @ApiPropertyOptional() branchId?: string;
  @ApiPropertyOptional({ type: String, format: 'date' }) admissionDate?: Date;
  @ApiPropertyOptional({ enum: StudentStatus }) status?: StudentStatus = StudentStatus.ACTIVE;
  @ApiPropertyOptional({ enum: BeltLevel }) currentBelt?: BeltLevel = BeltLevel.WHITE;
  @ApiPropertyOptional({ type: String, format: 'date' }) currentBeltSince?: Date;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() addressLine1?: string;
  @ApiPropertyOptional() addressLine2?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() state?: string;
  @ApiPropertyOptional({ default: 'India' }) country?: string = 'India';
  @ApiPropertyOptional() postalCode?: string;
  @ApiPropertyOptional() schoolName?: string;
  @ApiPropertyOptional() schoolClass?: string;
  @ApiPropertyOptional() hobbies?: string;
  @ApiPropertyOptional() languages?: string;
  @ApiPropertyOptional() medicalConditions?: string;
  @ApiPropertyOptional() allergies?: string;
  @ApiPropertyOptional() medications?: string;
  @ApiPropertyOptional() bloodPressure?: string;
  @ApiPropertyOptional() heightCm?: number;
  @ApiPropertyOptional() weightKg?: number;
  @ApiPropertyOptional() emergencyContactName?: string;
  @ApiPropertyOptional() emergencyContactPhone?: string;
  @ApiPropertyOptional() emergencyContactRelation?: string;
  @ApiPropertyOptional() guardianName?: string;
  @ApiPropertyOptional() guardianPhone?: string;
  @ApiPropertyOptional() guardianEmail?: string;
  @ApiPropertyOptional() guardianOccupation?: string;
  @ApiPropertyOptional() parentId?: string;
  @ApiPropertyOptional({ type: [String] }) batchIds?: string[];
  @ApiPropertyOptional() notes?: string;
}

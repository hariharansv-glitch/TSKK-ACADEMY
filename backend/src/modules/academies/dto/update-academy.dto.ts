import { ApiPropertyOptional } from '@nestjs/swagger';
import { AcademyDiscipline } from '@prisma/client';
import { z } from 'zod';

export const updateAcademySchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  discipline: z.nativeEnum(AcademyDiscipline).optional(),
  primaryColor: z.string().trim().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional(),
  logoUrl: z.string().url().nullable().optional(),
  contactEmail: z.string().trim().toLowerCase().email().max(254).optional(),
  contactPhone: z.string().trim().min(6).max(20).optional(),
  websiteUrl: z.string().url().nullable().optional(),
  registrationNumber: z.string().trim().max(64).nullable().optional(),
  taxNumber: z.string().trim().max(64).nullable().optional(),
  foundedYear: z.coerce.number().int().min(1800).max(new Date().getFullYear()).nullable().optional(),
  addressLine1: z.string().trim().min(1).max(160).optional(),
  addressLine2: z.string().trim().max(160).nullable().optional(),
  city: z.string().trim().min(1).max(80).optional(),
  state: z.string().trim().min(1).max(80).optional(),
  country: z.string().trim().min(1).max(80).optional(),
  postalCode: z.string().trim().min(3).max(16).optional(),
  timezone: z.string().trim().max(64).optional(),
  currency: z.string().trim().length(3).optional(),
});
export type UpdateAcademyInput = z.infer<typeof updateAcademySchema>;

export class UpdateAcademyDto implements UpdateAcademyInput {
  @ApiPropertyOptional() name?: string;
  @ApiPropertyOptional({ enum: AcademyDiscipline }) discipline?: AcademyDiscipline;
  @ApiPropertyOptional() primaryColor?: string;
  @ApiPropertyOptional() logoUrl?: string | null;
  @ApiPropertyOptional() contactEmail?: string;
  @ApiPropertyOptional() contactPhone?: string;
  @ApiPropertyOptional() websiteUrl?: string | null;
  @ApiPropertyOptional() registrationNumber?: string | null;
  @ApiPropertyOptional() taxNumber?: string | null;
  @ApiPropertyOptional() foundedYear?: number | null;
  @ApiPropertyOptional() addressLine1?: string;
  @ApiPropertyOptional() addressLine2?: string | null;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() state?: string;
  @ApiPropertyOptional() country?: string;
  @ApiPropertyOptional() postalCode?: string;
  @ApiPropertyOptional() timezone?: string;
  @ApiPropertyOptional() currency?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AcademyDiscipline, SubscriptionPlan } from '@prisma/client';
import { z } from 'zod';

export const createAcademySchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(96).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i).optional(),
  discipline: z.nativeEnum(AcademyDiscipline).default(AcademyDiscipline.SILAMBAM),
  primaryColor: z.string().trim().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional(),
  logoUrl: z.string().url().optional(),

  contactEmail: z.string().trim().toLowerCase().email().max(254),
  contactPhone: z.string().trim().min(6).max(20),
  websiteUrl: z.string().url().optional(),
  registrationNumber: z.string().trim().max(64).optional(),
  taxNumber: z.string().trim().max(64).optional(),
  foundedYear: z.coerce.number().int().min(1800).max(new Date().getFullYear()).optional(),

  addressLine1: z.string().trim().min(1).max(160),
  addressLine2: z.string().trim().max(160).optional(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  country: z.string().trim().min(1).max(80).default('India'),
  postalCode: z.string().trim().min(3).max(16),
  timezone: z.string().trim().max(64).default('Asia/Kolkata'),
  currency: z.string().trim().length(3).default('INR'),

  subscription: z
    .object({
      plan: z.nativeEnum(SubscriptionPlan).default(SubscriptionPlan.STARTER),
      seatLimit: z.coerce.number().int().min(1).max(100_000).default(50),
      pricePaise: z.coerce.number().int().min(0).default(0),
      trialDays: z.coerce.number().int().min(0).max(365).default(14),
    })
    .optional(),

  admin: z
    .object({
      email: z.string().trim().toLowerCase().email().max(254),
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      phone: z.string().trim().min(6).max(20).optional(),
      sendInvite: z.coerce.boolean().default(true),
    })
    .optional(),
});
export type CreateAcademyInput = z.infer<typeof createAcademySchema>;

export class CreateAcademyDto implements CreateAcademyInput {
  @ApiProperty() name!: string;
  @ApiPropertyOptional() slug?: string;
  @ApiProperty({ enum: AcademyDiscipline, default: AcademyDiscipline.SILAMBAM }) discipline: AcademyDiscipline = AcademyDiscipline.SILAMBAM;
  @ApiPropertyOptional({ example: '#B91C1C' }) primaryColor?: string;
  @ApiPropertyOptional() logoUrl?: string;

  @ApiProperty() contactEmail!: string;
  @ApiProperty() contactPhone!: string;
  @ApiPropertyOptional() websiteUrl?: string;
  @ApiPropertyOptional() registrationNumber?: string;
  @ApiPropertyOptional() taxNumber?: string;
  @ApiPropertyOptional() foundedYear?: number;

  @ApiProperty() addressLine1!: string;
  @ApiPropertyOptional() addressLine2?: string;
  @ApiProperty() city!: string;
  @ApiProperty() state!: string;
  @ApiProperty({ default: 'India' }) country: string = 'India';
  @ApiProperty() postalCode!: string;
  @ApiProperty({ default: 'Asia/Kolkata' }) timezone: string = 'Asia/Kolkata';
  @ApiProperty({ default: 'INR' }) currency: string = 'INR';

  @ApiPropertyOptional() subscription?: CreateAcademyInput['subscription'];
  @ApiPropertyOptional() admin?: CreateAcademyInput['admin'];
}

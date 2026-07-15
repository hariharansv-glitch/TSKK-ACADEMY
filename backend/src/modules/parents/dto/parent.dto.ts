import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const createParentSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(6).max(20),
  alternatePhone: z.string().trim().min(6).max(20).optional(),
  occupation: z.string().trim().max(120).optional(),
  addressLine1: z.string().trim().max(160).optional(),
  addressLine2: z.string().trim().max(160).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(16).optional(),
  createUserAccount: z.coerce.boolean().optional().default(false),
  childStudentIds: z.array(z.string().trim().min(1).max(48)).optional(),
});
export type CreateParentInput = z.infer<typeof createParentSchema>;

export class CreateParentDto {
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() email!: string;
  @ApiProperty() phone!: string;
  @ApiPropertyOptional() alternatePhone?: string;
  @ApiPropertyOptional() occupation?: string;
  @ApiPropertyOptional() addressLine1?: string;
  @ApiPropertyOptional() addressLine2?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() state?: string;
  @ApiPropertyOptional() postalCode?: string;
  @ApiPropertyOptional({ default: false }) createUserAccount: boolean = false;
  @ApiPropertyOptional({ type: [String] }) childStudentIds?: string[];
}

export const updateParentSchema = createParentSchema
  .omit({ createUserAccount: true, childStudentIds: true })
  .partial();
export type UpdateParentInput = z.infer<typeof updateParentSchema>;
export class UpdateParentDto {
  @ApiPropertyOptional() firstName?: string;
  @ApiPropertyOptional() lastName?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() alternatePhone?: string;
  @ApiPropertyOptional() occupation?: string;
  @ApiPropertyOptional() addressLine1?: string;
  @ApiPropertyOptional() addressLine2?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() state?: string;
  @ApiPropertyOptional() postalCode?: string;
}

export const listParentsSchema = paginationQuerySchema;
export type ListParentsQuery = z.infer<typeof listParentsSchema>;
export class ListParentsQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
}

export const linkChildSchema = z.object({
  studentId: z.string().trim().min(1).max(48),
  relationship: z.string().trim().min(1).max(48).default('Guardian'),
  isPrimary: z.coerce.boolean().optional().default(false),
  canPickup: z.coerce.boolean().optional().default(true),
});
export type LinkChildInput = z.infer<typeof linkChildSchema>;
export class LinkChildDto {
  @ApiProperty() studentId!: string;
  @ApiPropertyOptional({ default: 'Guardian' }) relationship: string = 'Guardian';
  @ApiPropertyOptional({ default: false }) isPrimary: boolean = false;
  @ApiPropertyOptional({ default: true }) canPickup: boolean = true;
}

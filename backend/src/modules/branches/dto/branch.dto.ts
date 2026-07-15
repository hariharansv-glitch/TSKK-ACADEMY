import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const createBranchSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9-_.]+$/),
  addressLine1: z.string().trim().min(1).max(160),
  addressLine2: z.string().trim().max(160).optional(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  country: z.string().trim().min(1).max(80).default('India'),
  postalCode: z.string().trim().min(3).max(16),
  phone: z.string().trim().min(6).max(20).optional(),
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  managerId: z.string().trim().min(1).max(48).optional(),
  isPrimary: z.coerce.boolean().optional().default(false),
  isActive: z.coerce.boolean().optional().default(true),
});
export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export class CreateBranchDto implements CreateBranchInput {
  @ApiProperty() name!: string;
  @ApiProperty() code!: string;
  @ApiProperty() addressLine1!: string;
  @ApiPropertyOptional() addressLine2?: string;
  @ApiProperty() city!: string;
  @ApiProperty() state!: string;
  @ApiProperty({ default: 'India' }) country: string = 'India';
  @ApiProperty() postalCode!: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() managerId?: string;
  @ApiPropertyOptional({ default: false }) isPrimary: boolean = false;
  @ApiPropertyOptional({ default: true }) isActive: boolean = true;
}

export const updateBranchSchema = createBranchSchema.partial();
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

export class UpdateBranchDto implements UpdateBranchInput {
  @ApiPropertyOptional() name?: string;
  @ApiPropertyOptional() code?: string;
  @ApiPropertyOptional() addressLine1?: string;
  @ApiPropertyOptional() addressLine2?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() state?: string;
  @ApiPropertyOptional() country?: string;
  @ApiPropertyOptional() postalCode?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() managerId?: string;
  @ApiPropertyOptional() isPrimary?: boolean;
  @ApiPropertyOptional() isActive?: boolean;
}

export const listBranchesSchema = paginationQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
});
export type ListBranchesQuery = z.infer<typeof listBranchesSchema>;
export class ListBranchesQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional() isActive?: boolean;
}

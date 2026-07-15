import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CertificateType } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const issueCertificateSchema = z.object({
  studentId: z.string().trim().min(1).max(48),
  type: z.nativeEnum(CertificateType),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  validUntil: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type IssueCertificateInput = z.infer<typeof issueCertificateSchema>;
export class IssueCertificateDto {
  @ApiProperty() studentId!: string;
  @ApiProperty({ enum: CertificateType }) type!: CertificateType;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() validUntil?: Date;
  @ApiPropertyOptional() metadata?: Record<string, unknown>;
}

export const listCertificatesSchema = paginationQuerySchema.extend({
  studentId: z.string().trim().min(1).max(48).optional(),
  type: z.nativeEnum(CertificateType).optional(),
  includeRevoked: z.coerce.boolean().optional().default(false),
});
export type ListCertificatesQuery = z.infer<typeof listCertificatesSchema>;
export class ListCertificatesQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional() studentId?: string;
  @ApiPropertyOptional({ enum: CertificateType }) type?: CertificateType;
  @ApiPropertyOptional() includeRevoked?: boolean;
}

export const revokeCertificateSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
export type RevokeCertificateInput = z.infer<typeof revokeCertificateSchema>;
export class RevokeCertificateDto {
  @ApiProperty() reason!: string;
}

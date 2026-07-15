import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().trim().max(200).optional(),
  sortBy: z.string().trim().max(64).optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export class PaginationQueryDto implements PaginationQuery {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 20 })
  pageSize = 20;

  @ApiPropertyOptional()
  search?: string;

  @ApiPropertyOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  sortDir: 'asc' | 'desc' = 'desc';
}

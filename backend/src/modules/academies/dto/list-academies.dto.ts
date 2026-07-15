import { ApiPropertyOptional } from '@nestjs/swagger';
import { AcademyDiscipline, AcademyStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const listAcademiesSchema = paginationQuerySchema.extend({
  status: z.nativeEnum(AcademyStatus).optional(),
  discipline: z.nativeEnum(AcademyDiscipline).optional(),
});
export type ListAcademiesQuery = z.infer<typeof listAcademiesSchema>;

export class ListAcademiesQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional({ enum: ['asc', 'desc'] }) sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional({ enum: AcademyStatus }) status?: AcademyStatus;
  @ApiPropertyOptional({ enum: AcademyDiscipline }) discipline?: AcademyDiscipline;
}

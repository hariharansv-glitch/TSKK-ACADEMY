import { ApiProperty } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
  @ApiProperty() hasNext!: boolean;
  @ApiProperty() hasPrevious!: boolean;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true })
  data!: T[];

  @ApiProperty({ type: PaginationMeta })
  meta!: PaginationMeta;
}

export function buildPaginationMeta(
  page: number,
  pageSize: number,
  total: number,
): PaginationMeta {
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

export function paginate<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number,
): PaginatedResponseDto<T> {
  return { data, meta: buildPaginationMeta(page, pageSize, total) };
}

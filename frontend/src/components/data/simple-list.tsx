'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { apiListRequest } from '@/lib/api-client';
import { useDebouncedValue } from '@/lib/hooks';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationBar } from '@/components/data/pagination-bar';
import { EmptyState } from '@/components/data/empty-state';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface Props<T> {
  title: string;
  description?: string;
  endpoint: string;
  columns: Column<T>[];
  queryKey: unknown[];
  actions?: React.ReactNode;
  searchable?: boolean;
  emptyTitle?: string;
  emptyIcon?: LucideIcon;
  emptyDescription?: string;
  extraParams?: Record<string, string | number | boolean | undefined>;
}

export function SimpleListPage<T extends { id: string }>({
  title,
  description,
  endpoint,
  columns,
  queryKey,
  actions,
  searchable = true,
  emptyTitle = 'Nothing here yet',
  emptyIcon,
  emptyDescription,
  extraParams,
}: Props<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const debounced = useDebouncedValue(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: [...queryKey, debounced, page, extraParams],
    queryFn: () =>
      apiListRequest<T>({
        method: 'GET',
        url: endpoint,
        params: { page, pageSize, search: debounced || undefined, ...(extraParams ?? {}) },
      }),
  });
  const rows = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>

      {searchable && (
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      )}

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col.key} className={col.className}>
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className={col.className}>
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar
              page={data?.meta.page ?? page}
              pageSize={data?.meta.pageSize ?? pageSize}
              total={data?.meta.total ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}

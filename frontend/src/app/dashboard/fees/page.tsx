'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Receipt, Search } from 'lucide-react';

import { apiListRequest } from '@/lib/api-client';
import { useDebouncedValue } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/data/empty-state';
import { PaginationBar } from '@/components/data/pagination-bar';
import { formatDate, formatINR } from '@/lib/utils';

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  type: string;
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED' | 'WAIVED';
  totalPaise: number;
  balancePaise: number;
  dueDate: string;
  student: { id: string; studentCode: string; firstName: string; lastName: string };
}

const STATUS_VARIANT: Record<InvoiceRow['status'], 'success' | 'destructive' | 'warning' | 'muted' | 'info'> = {
  PAID: 'success',
  PENDING: 'warning',
  PARTIAL: 'info',
  OVERDUE: 'destructive',
  CANCELLED: 'muted',
  REFUNDED: 'muted',
  WAIVED: 'muted',
};

export default function FeesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const debounced = useDebouncedValue(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', debounced, status, page],
    queryFn: () =>
      apiListRequest<InvoiceRow>({
        method: 'GET',
        url: '/fees/invoices',
        params: { page, pageSize, search: debounced || undefined, status: status || undefined },
      }),
  });
  const rows = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fees & Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Manage fee plans, invoices and payments across your academy.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/fees/plans">Fee plans</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/fees/invoices/new">
              <Plus className="h-4 w-4" /> New invoice
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Invoice or student…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          {(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED', 'WAIVED'] as const).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No invoices yet"
            description="Once you generate invoices, they'll appear here for tracking and payment collection."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {inv.student.firstName} {inv.student.lastName}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{inv.student.studentCode}</div>
                    </TableCell>
                    <TableCell>{inv.type}</TableCell>
                    <TableCell className="font-medium">{formatINR(inv.totalPaise)}</TableCell>
                    <TableCell className={inv.balancePaise > 0 ? 'font-medium text-primary' : ''}>
                      {formatINR(inv.balancePaise)}
                    </TableCell>
                    <TableCell>{formatDate(inv.dueDate)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inv.status]}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/dashboard/fees/invoices/${inv.id}`}>Open</Link>
                      </Button>
                    </TableCell>
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

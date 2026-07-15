'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardList, LayoutList, QrCode, Search } from 'lucide-react';

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
import { formatDateTime } from '@/lib/utils';

interface AttendanceRow {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'HOLIDAY' | 'LEAVE';
  method: 'QR' | 'MANUAL' | 'BATCH' | 'FACE_RECOGNITION';
  checkInAt: string | null;
  student: { id: string; studentCode: string; firstName: string; lastName: string };
  batch?: { id: string; name: string } | null;
}

const STATUS_VARIANT: Record<AttendanceRow['status'], 'success' | 'destructive' | 'warning' | 'info' | 'muted'> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'destructive',
  EXCUSED: 'info',
  HOLIDAY: 'muted',
  LEAVE: 'muted',
};

export default function AttendancePage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');
  const pageSize = 20;
  const debounced = useDebouncedValue(search, 300);

  useEffect(() => setPage(1), [debounced, status]);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', debounced, status, page],
    queryFn: () =>
      apiListRequest<AttendanceRow>({
        method: 'GET',
        url: '/attendance',
        params: {
          page,
          pageSize,
          search: debounced || undefined,
          status: status || undefined,
        },
      }),
  });
  const rows = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">Manual entries, batch marks and QR scans.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/attendance/holidays">
              <CalendarDays className="h-4 w-4" /> Holidays
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/attendance/batch">
              <LayoutList className="h-4 w-4" /> Batch report
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/attendance/manual">
              <ClipboardList className="h-4 w-4" /> Mark attendance
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/attendance/scan">
              <QrCode className="h-4 w-4" /> Scan QR
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          {(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'LEAVE', 'HOLIDAY'] as const).map((s) => (
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
            icon={ClipboardList}
            title="No attendance records yet"
            description="Once you start scanning QR codes or marking attendance, it will show up here."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Check-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(r.date)}</TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {r.student.firstName} {r.student.lastName}
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">
                        {r.student.studentCode}
                      </div>
                    </TableCell>
                    <TableCell>{r.batch?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {r.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.checkInAt ? formatDateTime(r.checkInAt) : '—'}
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

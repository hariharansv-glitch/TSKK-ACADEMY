'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';

import { apiListRequest } from '@/lib/api-client';
import { useDebouncedValue } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/data/empty-state';
import { PaginationBar } from '@/components/data/pagination-bar';
import { formatDate } from '@/lib/utils';

interface StudentRow {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  gender: string;
  currentBelt: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LEFT' | 'SUSPENDED';
  admissionDate: string;
  photoUrl?: string | null;
  branch?: { id: string; name: string } | null;
}

export default function StudentsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const debounced = useDebouncedValue(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['students', debounced, page],
    queryFn: () =>
      apiListRequest<StudentRow>({
        method: 'GET',
        url: '/students',
        params: { page, pageSize, search: debounced || undefined },
      }),
  });

  const rows = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">Enrolled students across your academy.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/students/new">
            <Plus className="h-4 w-4" /> Add student
          </Link>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name or student code…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
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
            title="No students yet"
            description="Enrol your first student to get started."
            action={
              <Button asChild size="sm">
                <Link href="/dashboard/students/new">
                  <Plus className="h-4 w-4" /> Add student
                </Link>
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Belt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Admitted</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.studentCode}</TableCell>
                    <TableCell className="font-medium">
                      {s.firstName} {s.lastName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">{s.currentBelt}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          s.status === 'ACTIVE'
                            ? 'success'
                            : s.status === 'LEFT'
                              ? 'destructive'
                              : 'warning'
                        }
                      >
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(s.admissionDate)}</TableCell>
                    <TableCell>{s.branch?.name ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/dashboard/students/${s.id}`}>Open</Link>
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


'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

import { apiListRequest, apiRequest, extractErrorMessage } from '@/lib/api-client';
import { useDebouncedValue } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Field, FormGrid } from '@/components/forms/field';

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
  currentBelt: string;
}

export default function ManualAttendancePage() {
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [status, setStatus] = useState('PRESENT');
  const [note, setNote] = useState('');
  const debounced = useDebouncedValue(search, 300);

  const searchQuery = useQuery({
    queryKey: ['students-search', debounced],
    queryFn: () =>
      apiListRequest<StudentRow>({
        method: 'GET',
        url: '/students',
        params: { search: debounced || undefined, pageSize: 8 },
      }),
    enabled: debounced.length > 0,
  });

  const markMutation = useMutation({
    mutationFn: () =>
      apiRequest({
        method: 'POST',
        url: '/attendance/mark',
        data: {
          studentId,
          status,
          note: note || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Attendance recorded');
      setNote('');
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Failed to mark attendance')),
  });

  const selected = searchQuery.data?.items.find((s) => s.id === studentId);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
          <Link href="/dashboard/attendance">
            <ArrowLeft className="h-4 w-4" /> Attendance
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Manual attendance</h1>
        <p className="text-sm text-muted-foreground">
          Search a student, choose a status, and record attendance instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Find a student</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name or code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              {searchQuery.isLoading && <Skeleton className="m-3 h-32" />}
              {!searchQuery.isLoading && searchQuery.data && (
                <ul className="divide-y">
                  {searchQuery.data.items.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setStudentId(s.id)}
                        className={
                          'flex w-full items-center justify-between gap-3 p-3 text-left text-sm transition-colors hover:bg-accent ' +
                          (studentId === s.id ? 'bg-accent' : '')
                        }
                      >
                        <div>
                          <div className="font-medium">
                            {s.firstName} {s.lastName}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">{s.studentCode}</div>
                        </div>
                        <span className="text-xs text-muted-foreground">{s.currentBelt}</span>
                      </button>
                    </li>
                  ))}
                  {searchQuery.data.items.length === 0 && (
                    <li className="p-6 text-center text-sm text-muted-foreground">No matching students.</li>
                  )}
                </ul>
              )}
              {!searchQuery.data && !searchQuery.isLoading && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Type at least one character to search.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mark attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              {selected ? (
                <div>
                  Recording for:{' '}
                  <span className="font-medium">
                    {selected.firstName} {selected.lastName}
                  </span>{' '}
                  <span className="font-mono text-xs text-muted-foreground">({selected.studentCode})</span>
                </div>
              ) : (
                <span className="text-muted-foreground">Pick a student on the left first.</span>
              )}
            </div>
            <FormGrid>
              <Field label="Status" required>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="LATE">Late</SelectItem>
                    <SelectItem value="ABSENT">Absent</SelectItem>
                    <SelectItem value="EXCUSED">Excused</SelectItem>
                    <SelectItem value="HOLIDAY">Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Note">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional remark" />
              </Field>
            </FormGrid>
            <Button
              className="w-full"
              disabled={!studentId}
              loading={markMutation.isPending}
              onClick={() => markMutation.mutate()}
            >
              <UserCheck className="h-4 w-4" /> Record attendance
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

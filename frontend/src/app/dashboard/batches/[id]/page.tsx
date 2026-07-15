'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ScrollText, Pencil, Plus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

import { apiListRequest, apiRequest, extractErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface RosterEntry {
  id: string;
  joinedAt: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode: string;
    currentBelt: string;
    photoUrl?: string;
  };
}

interface BatchDetail {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  scheduleJson: Array<{ weekday: number; start: string; end: string }>;
  class: { id: string; name: string; minBelt?: string; maxBelt?: string };
  instructor?: { firstName: string; lastName: string };
  branch?: { name: string };
  students: RosterEntry[];
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [studentSearch, setStudentSearch] = useState('');

  const batch = useQuery({
    queryKey: ['batch', id],
    queryFn: () => apiRequest<BatchDetail>({ method: 'GET', url: `/batches/${id}` }),
  });

  const students = useQuery({
    queryKey: ['batch-students-search', studentSearch],
    queryFn: () =>
      apiListRequest<{ id: string; firstName: string; lastName: string; studentCode: string }>({
        method: 'GET',
        url: '/students',
        params: { search: studentSearch || undefined, pageSize: 8, status: 'ACTIVE' },
      }),
    enabled: studentSearch.length >= 2,
  });

  const enroll = useMutation({
    mutationFn: (studentId: string) =>
      apiRequest({ method: 'POST', url: `/batches/${id}/students`, data: { studentId } }),
    onSuccess: () => {
      toast.success('Student enrolled');
      setStudentSearch('');
      qc.invalidateQueries({ queryKey: ['batch', id] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not enroll')),
  });

  const unenroll = useMutation({
    mutationFn: (studentId: string) =>
      apiRequest({ method: 'DELETE', url: `/batches/${id}/students/${studentId}` }),
    onSuccess: () => {
      toast.success('Student removed');
      qc.invalidateQueries({ queryKey: ['batch', id] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not remove')),
  });

  if (batch.isLoading || !batch.data) return <Skeleton className="h-64 w-full" />;
  const b = batch.data;
  const enrolledIds = new Set(b.students.map((s) => s.student.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild size="sm" variant="ghost" className="-ml-2 h-7">
          <Link href="/dashboard/batches"><ArrowLeft className="h-4 w-4" /> Batches</Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/batches/${id}/assignments`}><ScrollText className="h-4 w-4" /> Assignments</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/batches/${id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{b.name}</h1>
          <p className="text-sm text-muted-foreground">
            {b.class.name} · {b.branch?.name ?? 'All branches'} ·{' '}
            {b.instructor ? `Coach ${b.instructor.firstName} ${b.instructor.lastName}` : 'No instructor assigned'}
          </p>
        </div>
        <Badge variant={b.isActive ? 'success' : 'muted'}>{b.isActive ? 'Active' : 'Paused'}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Duration</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm">{new Date(b.startDate).toLocaleDateString('en-IN')}</p>
            <p className="text-sm text-muted-foreground">
              {b.endDate ? `Ends ${new Date(b.endDate).toLocaleDateString('en-IN')}` : 'Ongoing'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Capacity</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {b.students.length}
              <span className="text-sm font-normal text-muted-foreground"> / {b.capacity}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Belt range</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm">{b.class.minBelt ?? '—'} → {b.class.maxBelt ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {b.scheduleJson.map((slot, i) => (
              <li key={i} className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{WEEKDAYS[slot.weekday]}</p>
                <p className="text-muted-foreground">{slot.start} – {slot.end}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Roster ({b.students.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Add student</label>
            <Input
              placeholder="Search by name or code"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
            {studentSearch.length >= 2 && (
              <div className="mt-2 space-y-1 rounded-md border bg-background p-2 text-sm">
                {students.isLoading ? (
                  <p className="text-muted-foreground">Searching…</p>
                ) : students.data?.items.length === 0 ? (
                  <p className="text-muted-foreground">No matches</p>
                ) : (
                  students.data?.items
                    .filter((s) => !enrolledIds.has(s.id))
                    .map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => enroll.mutate(s.id)}
                        disabled={enroll.isPending}
                        className="flex w-full items-center justify-between rounded px-2 py-1 hover:bg-muted"
                      >
                        <span>{s.firstName} {s.lastName} <span className="text-muted-foreground">({s.studentCode})</span></span>
                        <Plus className="h-4 w-4" />
                      </button>
                    ))
                )}
              </div>
            )}
          </div>

          <div className="divide-y rounded-md border">
            {b.students.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">No students enrolled yet.</p>
            )}
            {b.students.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                    {e.student.firstName.charAt(0)}
                    {e.student.lastName.charAt(0)}
                  </div>
                  <div>
                    <Link className="font-medium hover:underline" href={`/dashboard/students/${e.student.id}`}>
                      {e.student.firstName} {e.student.lastName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {e.student.studentCode} · {e.student.currentBelt} · Joined {new Date(e.joinedAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Remove ${e.student.firstName} from ${b.name}?`)) unenroll.mutate(e.student.id);
                  }}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

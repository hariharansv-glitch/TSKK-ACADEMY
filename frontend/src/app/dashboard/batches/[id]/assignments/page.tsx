'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Plus, ScrollText } from 'lucide-react';
import { toast } from 'sonner';

import { apiListRequest, apiRequest, extractErrorMessage } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FormGrid } from '@/components/forms/field';
import { Skeleton } from '@/components/ui/skeleton';

interface AssignmentRow {
  id: string;
  title: string;
  description: string;
  dueAt: string;
  maxMarks: number;
  instructor?: { firstName: string; lastName: string };
  _count: { submissions: number };
}

export default function BatchAssignmentsPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['batch-assignments', id],
    queryFn: () => apiRequest<AssignmentRow[]>({ method: 'GET', url: `/learning/batches/${id}/assignments` }),
  });

  const instructors = useQuery({
    queryKey: ['instructors-all'],
    queryFn: () => apiListRequest<{ id: string; firstName: string; lastName: string }>({ method: 'GET', url: '/instructors', params: { pageSize: 100 } }),
  });

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', dueAt: '', maxMarks: 100, instructorId: '' });

  const create = useMutation({
    mutationFn: () =>
      apiRequest({
        method: 'POST',
        url: '/learning/assignments',
        data: {
          batchId: id,
          instructorId: form.instructorId,
          title: form.title,
          description: form.description,
          dueAt: new Date(form.dueAt).toISOString(),
          maxMarks: form.maxMarks,
        },
      }),
    onSuccess: () => {
      toast.success('Assignment created');
      setCreating(false);
      setForm({ title: '', description: '', dueAt: '', maxMarks: 100, instructorId: '' });
      qc.invalidateQueries({ queryKey: ['batch-assignments', id] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not create assignment')),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href={`/dashboard/batches/${id}`}><ArrowLeft className="h-4 w-4" /> Batch</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
        </div>
        {!creating && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New assignment</Button>}
      </div>

      {creating && (
        <Card>
          <CardHeader><CardTitle>New assignment</CardTitle></CardHeader>
          <CardContent>
            <FormGrid>
              <Field label="Title" required className="sm:col-span-2">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              <Field label="Due" required>
                <Input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
              </Field>
              <Field label="Max marks">
                <Input type="number" min={1} value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })} />
              </Field>
              <Field label="Instructor" required className="sm:col-span-2">
                <Select value={form.instructorId} onValueChange={(v) => setForm({ ...form, instructorId: v })}>
                  <SelectTrigger><SelectValue placeholder="Assign an instructor" /></SelectTrigger>
                  <SelectContent>
                    {instructors.data?.items.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.firstName} {i.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Description" required className="sm:col-span-2">
                <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </FormGrid>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              <Button
                loading={create.isPending}
                disabled={!form.title || !form.description || !form.dueAt || !form.instructorId}
                onClick={() => create.mutate()}
              >
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {list.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-2">
          {list.data?.length === 0 && (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No assignments yet.</CardContent></Card>
          )}
          {list.data?.map((a) => (
            <Link key={a.id} href={`/dashboard/assignments/${a.id}`}>
              <Card className="transition-colors hover:border-primary/60">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ScrollText className="h-4 w-4" /> {a.title}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {a.instructor ? `${a.instructor.firstName} ${a.instructor.lastName}` : '—'} · Due {formatDate(a.dueAt)} · {a.maxMarks} marks
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="muted">{a._count.submissions} submissions</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

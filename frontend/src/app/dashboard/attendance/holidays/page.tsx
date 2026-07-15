'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Field, FormGrid } from '@/components/forms/field';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';

interface Holiday {
  id: string;
  name: string;
  date: string;
  isRecurring: boolean;
  description?: string;
}

export default function HolidaysPage() {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', date: '', isRecurring: false, description: '' });

  const list = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => apiRequest<Holiday[]>({ method: 'GET', url: '/attendance/holidays', params: { year } }),
  });

  const create = useMutation({
    mutationFn: () =>
      apiRequest({
        method: 'POST',
        url: '/attendance/holidays',
        data: {
          ...form,
          date: new Date(form.date).toISOString(),
          description: form.description || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Holiday added');
      setCreating(false);
      setForm({ name: '', date: '', isRecurring: false, description: '' });
      qc.invalidateQueries({ queryKey: ['holidays'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest({ method: 'DELETE', url: `/attendance/holidays/${id}` }),
    onSuccess: () => {
      toast.success('Holiday removed');
      qc.invalidateQueries({ queryKey: ['holidays'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/attendance"><ArrowLeft className="h-4 w-4" /> Attendance</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Holidays</h1>
          <p className="text-sm text-muted-foreground">Attendance is skipped on these days.</p>
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            className="w-28"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
          />
          <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add</Button>
        </div>
      </div>

      {creating && (
        <Card>
          <CardHeader><CardTitle>New holiday</CardTitle></CardHeader>
          <CardContent>
            <FormGrid>
              <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Date" required><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Recurring" className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isRecurring}
                    onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  Repeat every year (e.g. Republic Day, Diwali)
                </label>
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </FormGrid>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              <Button loading={create.isPending} disabled={!form.name || !form.date} onClick={() => create.mutate()}>
                Add holiday
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {list.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.data?.length === 0 && (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No holidays for {year}.</CardContent></Card>
          )}
          {list.data?.map((h) => (
            <Card key={h.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" /> {h.name}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{formatDate(h.date)}</p>
                </div>
                {h.isRecurring && <Badge variant="muted"><RotateCcw className="h-3 w-3" /> Annual</Badge>}
              </CardHeader>
              <CardContent className="flex justify-between text-sm">
                <p className="text-muted-foreground">{h.description ?? '—'}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { if (window.confirm(`Delete ${h.name}?`)) remove.mutate(h.id); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

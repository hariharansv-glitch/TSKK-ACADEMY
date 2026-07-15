'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { apiListRequest, apiRequest, extractErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FormGrid } from '@/components/forms/field';
import { Skeleton } from '@/components/ui/skeleton';

const BELTS = [
  'WHITE', 'YELLOW', 'ORANGE', 'GREEN', 'BLUE', 'PURPLE', 'BROWN', 'RED', 'BLACK_1', 'BLACK_2', 'BLACK_3', 'BLACK_4', 'BLACK_5',
];

interface ClassRow {
  id: string;
  name: string;
  description?: string;
  minBelt: string;
  maxBelt: string;
  minAge?: number;
  maxAge?: number;
  capacity: number;
  isActive: boolean;
  _count?: { batches: number };
  branch?: { name: string };
}

export default function ClassesPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['classes-list'],
    queryFn: () => apiListRequest<ClassRow>({ method: 'GET', url: '/classes', params: { pageSize: 100 } }),
  });

  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', minBelt: 'WHITE', maxBelt: 'BLACK_5',
    minAge: '', maxAge: '', capacity: 30, isActive: true,
  });

  const startEdit = (row?: ClassRow) => {
    if (row) {
      setForm({
        name: row.name,
        description: row.description ?? '',
        minBelt: row.minBelt,
        maxBelt: row.maxBelt,
        minAge: row.minAge ? String(row.minAge) : '',
        maxAge: row.maxAge ? String(row.maxAge) : '',
        capacity: row.capacity,
        isActive: row.isActive,
      });
      setEditing(row);
    } else {
      setForm({ name: '', description: '', minBelt: 'WHITE', maxBelt: 'BLACK_5', minAge: '', maxAge: '', capacity: 30, isActive: true });
      setEditing({ id: '__new__' } as ClassRow);
    }
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        minBelt: form.minBelt,
        maxBelt: form.maxBelt,
        minAge: form.minAge ? Number(form.minAge) : undefined,
        maxAge: form.maxAge ? Number(form.maxAge) : undefined,
        capacity: form.capacity,
        isActive: form.isActive,
      };
      if (editing?.id === '__new__') return apiRequest({ method: 'POST', url: '/classes', data: payload });
      return apiRequest({ method: 'PATCH', url: `/classes/${editing?.id}`, data: payload });
    },
    onSuccess: () => {
      toast.success('Class saved');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['classes-list'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not save class')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest({ method: 'DELETE', url: `/classes/${id}` }),
    onSuccess: () => {
      toast.success('Class deleted');
      qc.invalidateQueries({ queryKey: ['classes-list'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not delete')),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/batches"><ArrowLeft className="h-4 w-4" /> Batches</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
          <p className="text-sm text-muted-foreground">A class is a curriculum bucket; batches are its scheduled instances.</p>
        </div>
        <Button onClick={() => startEdit()}><Plus className="h-4 w-4" /> New class</Button>
      </div>

      {list.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.data?.items.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{c.description ?? '—'}</p>
                </div>
                <Badge variant={c.isActive ? 'success' : 'muted'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Belt: </span>{c.minBelt} → {c.maxBelt}</p>
                <p><span className="text-muted-foreground">Age: </span>{c.minAge ?? '—'} – {c.maxAge ?? '—'}</p>
                <p><span className="text-muted-foreground">Capacity: </span>{c.capacity}</p>
                <p><span className="text-muted-foreground">Batches: </span>{c._count?.batches ?? 0}</p>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /> Edit</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { if (window.confirm(`Delete ${c.name}?`)) remove.mutate(c.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {list.data?.items.length === 0 && (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No classes yet.</CardContent></Card>
          )}
        </div>
      )}

      {editing && (
        <Card>
          <CardHeader><CardTitle>{editing.id === '__new__' ? 'New class' : 'Edit class'}</CardTitle></CardHeader>
          <CardContent>
            <FormGrid>
              <Field label="Name" required className="sm:col-span-2">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Min belt">
                <Select value={form.minBelt} onValueChange={(v) => setForm({ ...form, minBelt: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BELTS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Max belt">
                <Select value={form.maxBelt} onValueChange={(v) => setForm({ ...form, maxBelt: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BELTS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Min age"><Input type="number" min={3} value={form.minAge} onChange={(e) => setForm({ ...form, minAge: e.target.value })} /></Field>
              <Field label="Max age"><Input type="number" min={3} value={form.maxAge} onChange={(e) => setForm({ ...form, maxAge: e.target.value })} /></Field>
              <Field label="Capacity"><Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></Field>
              <Field label="Active" className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  Class is offered
                </label>
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </FormGrid>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button loading={save.isPending} onClick={() => save.mutate()}>
                {editing.id === '__new__' ? 'Create class' : 'Save changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

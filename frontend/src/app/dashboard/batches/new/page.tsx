'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { apiListRequest, apiRequest, extractErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FormGrid, FormSection } from '@/components/forms/field';

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm required');
const schema = z.object({
  classId: z.string().min(1),
  branchId: z.string().optional().or(z.literal('')),
  instructorId: z.string().optional().or(z.literal('')),
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional().or(z.literal('')),
  capacity: z.coerce.number().int().min(1),
  schedule: z
    .array(z.object({ weekday: z.coerce.number().int().min(0).max(6), start: timeString, end: timeString }))
    .min(1),
});
type FormValues = z.infer<typeof schema>;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function NewBatchPage() {
  const router = useRouter();
  const classes = useQuery({
    queryKey: ['classes', 'all'],
    queryFn: () => apiListRequest<{ id: string; name: string }>({ method: 'GET', url: '/classes', params: { pageSize: 100, isActive: true } }),
  });
  const branches = useQuery({
    queryKey: ['branches', 'all'],
    queryFn: () => apiListRequest<{ id: string; name: string }>({ method: 'GET', url: '/branches', params: { pageSize: 100 } }),
  });
  const instructors = useQuery({
    queryKey: ['instructors', 'all'],
    queryFn: () => apiListRequest<{ id: string; firstName: string; lastName: string }>({ method: 'GET', url: '/instructors', params: { pageSize: 100 } }),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      classId: '',
      name: '',
      startDate: new Date().toISOString().slice(0, 10),
      capacity: 30,
      schedule: [{ weekday: 1, start: '17:00', end: '18:30' }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'schedule' });
  const errors = form.formState.errors;

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      apiRequest<{ id: string }>({
        method: 'POST',
        url: '/batches',
        data: {
          ...v,
          branchId: v.branchId || undefined,
          instructorId: v.instructorId || undefined,
          endDate: v.endDate || undefined,
        },
      }),
    onSuccess: (row) => {
      toast.success('Batch created');
      router.push(`/dashboard/batches/${row.id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not create batch')),
  });

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/batches"><ArrowLeft className="h-4 w-4" /> Batches</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">New batch</h1>
        </div>
        <Button type="submit" loading={create.isPending}>Create batch</Button>
      </div>

      <FormSection title="Basics">
        <FormGrid>
          <Field label="Class" required error={errors.classId?.message}>
            <Select value={form.watch('classId')} onValueChange={(v) => form.setValue('classId', v)}>
              <SelectTrigger><SelectValue placeholder="Choose class" /></SelectTrigger>
              <SelectContent>
                {classes.data?.items.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Branch">
            <Select value={form.watch('branchId') ?? ''} onValueChange={(v) => form.setValue('branchId', v)}>
              <SelectTrigger><SelectValue placeholder="Any branch" /></SelectTrigger>
              <SelectContent>
                {branches.data?.items.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Batch name" required error={errors.name?.message}>
            <Input placeholder="Morning Beginners" {...form.register('name')} />
          </Field>
          <Field label="Instructor">
            <Select value={form.watch('instructorId') ?? ''} onValueChange={(v) => form.setValue('instructorId', v)}>
              <SelectTrigger><SelectValue placeholder="Assign later" /></SelectTrigger>
              <SelectContent>
                {instructors.data?.items.map((i) => <SelectItem key={i.id} value={i.id}>{i.firstName} {i.lastName}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Start date" required><Input type="date" {...form.register('startDate')} /></Field>
          <Field label="End date"><Input type="date" {...form.register('endDate')} /></Field>
          <Field label="Capacity" required><Input type="number" min={1} {...form.register('capacity')} /></Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Weekly schedule">
        <div className="space-y-2">
          {fields.map((f, idx) => (
            <div key={f.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,160px)_minmax(0,120px)_minmax(0,120px)_auto]">
              <Select
                value={String(form.watch(`schedule.${idx}.weekday`))}
                onValueChange={(v) => form.setValue(`schedule.${idx}.weekday`, Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="time" {...form.register(`schedule.${idx}.start`)} />
              <Input type="time" {...form.register(`schedule.${idx}.end`)} />
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} disabled={fields.length === 1}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => append({ weekday: 1, start: '17:00', end: '18:30' })}>
            <Plus className="h-4 w-4" /> Add slot
          </Button>
        </div>
      </FormSection>
    </form>
  );
}

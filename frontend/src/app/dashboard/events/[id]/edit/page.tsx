'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FormGrid, FormSection } from '@/components/forms/field';
import { Skeleton } from '@/components/ui/skeleton';

const EVENT_TYPES = ['TOURNAMENT', 'CAMP', 'SEMINAR', 'WORKSHOP', 'DEMO', 'CYCLING', 'CULTURAL', 'OTHER'] as const;

const schema = z.object({
  title: z.string().min(3),
  description: z.string().min(1),
  type: z.enum(EVENT_TYPES),
  venue: z.string().min(1),
  addressLine1: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  startAt: z.string(),
  endAt: z.string(),
  capacity: z.coerce.number().int().positive().optional(),
  feePaise: z.coerce.number().int().nonnegative().optional(),
  isPaid: z.coerce.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

const toLocal = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const event = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiRequest<Record<string, unknown>>({ method: 'GET', url: `/events/${id}` }),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const errors = form.formState.errors;

  useEffect(() => {
    if (!event.data) return;
    const e = event.data as Record<string, unknown>;
    form.reset({
      title: (e.title as string) ?? '',
      description: (e.description as string) ?? '',
      type: ((e.type as string) ?? 'WORKSHOP') as FormValues['type'],
      venue: (e.venue as string) ?? '',
      addressLine1: (e.addressLine1 as string) ?? '',
      city: (e.city as string) ?? '',
      state: (e.state as string) ?? '',
      startAt: toLocal(e.startAt as string),
      endAt: toLocal(e.endAt as string),
      capacity: e.capacity as number | undefined,
      feePaise: e.feePaise as number | undefined,
      isPaid: (e.isPaid as boolean) ?? false,
    });
  }, [event.data, form]);

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      apiRequest({
        method: 'PATCH',
        url: `/events/${id}`,
        data: {
          ...v,
          startAt: new Date(v.startAt).toISOString(),
          endAt: new Date(v.endAt).toISOString(),
          addressLine1: v.addressLine1 || undefined,
          city: v.city || undefined,
          state: v.state || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Event updated');
      qc.invalidateQueries({ queryKey: ['event', id] });
      router.push(`/dashboard/events/${id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not update event')),
  });

  if (event.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href={`/dashboard/events/${id}`}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Edit event</h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>Save changes</Button>
        </div>
      </div>

      <FormSection title="Basics">
        <FormGrid>
          <Field label="Title" required error={errors.title?.message} className="sm:col-span-2">
            <Input {...form.register('title')} />
          </Field>
          <Field label="Type" required>
            <Select
              value={form.watch('type')}
              onValueChange={(v) => form.setValue('type', v as FormValues['type'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Paid event">
            <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
              <input type="checkbox" {...form.register('isPaid')} className="h-4 w-4 accent-primary" />
              This event has a fee
            </label>
          </Field>
          <Field label="Description" required className="sm:col-span-2">
            <Textarea rows={4} {...form.register('description')} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Schedule & venue">
        <FormGrid>
          <Field label="Start" required><Input type="datetime-local" {...form.register('startAt')} /></Field>
          <Field label="End" required><Input type="datetime-local" {...form.register('endAt')} /></Field>
          <Field label="Venue" required className="sm:col-span-2"><Input {...form.register('venue')} /></Field>
          <Field label="Address"><Input {...form.register('addressLine1')} /></Field>
          <Field label="City"><Input {...form.register('city')} /></Field>
          <Field label="State"><Input {...form.register('state')} /></Field>
          <Field label="Capacity"><Input type="number" min={1} {...form.register('capacity')} /></Field>
          <Field label="Fee (₹)"><Input type="number" min={0} {...form.register('feePaise')} /></Field>
        </FormGrid>
      </FormSection>
    </form>
  );
}

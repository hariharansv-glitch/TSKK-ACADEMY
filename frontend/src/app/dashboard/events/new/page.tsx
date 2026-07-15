'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FormGrid, FormSection } from '@/components/forms/field';

const EVENT_TYPES = ['TOURNAMENT', 'CAMP', 'SEMINAR', 'WORKSHOP', 'DEMO', 'CYCLING', 'CULTURAL', 'OTHER'] as const;

const schema = z
  .object({
    title: z.string().min(3),
    description: z.string().min(10),
    type: z.enum(EVENT_TYPES),
    venue: z.string().min(2),
    addressLine1: z.string().optional().or(z.literal('')),
    city: z.string().optional().or(z.literal('')),
    state: z.string().optional().or(z.literal('')),
    startAt: z.string(),
    endAt: z.string(),
    registrationStartAt: z.string().optional().or(z.literal('')),
    registrationEndAt: z.string().optional().or(z.literal('')),
    capacity: z.coerce.number().int().positive().optional(),
    feePaise: z.coerce.number().int().nonnegative().optional(),
    isPaid: z.coerce.boolean().optional(),
    requiresApproval: z.coerce.boolean().optional(),
  })
  .refine((v) => new Date(v.endAt) > new Date(v.startAt), { message: 'End must be after start', path: ['endAt'] });
type FormValues = z.infer<typeof schema>;

export default function NewEventPage() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'WORKSHOP',
      startAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16),
      endAt: new Date(Date.now() + 7 * 24 * 3600 * 1000 + 2 * 3600 * 1000).toISOString().slice(0, 16),
      isPaid: false,
      requiresApproval: false,
    },
  });
  const errors = form.formState.errors;

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      apiRequest<{ id: string }>({
        method: 'POST',
        url: '/events',
        data: {
          ...v,
          startAt: new Date(v.startAt).toISOString(),
          endAt: new Date(v.endAt).toISOString(),
          registrationStartAt: v.registrationStartAt ? new Date(v.registrationStartAt).toISOString() : undefined,
          registrationEndAt: v.registrationEndAt ? new Date(v.registrationEndAt).toISOString() : undefined,
          addressLine1: v.addressLine1 || undefined,
          city: v.city || undefined,
          state: v.state || undefined,
        },
      }),
    onSuccess: (ev) => {
      toast.success('Event created');
      router.push(`/dashboard/events/${ev.id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not create event')),
  });

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/events">
              <ArrowLeft className="h-4 w-4" /> Events
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Create event</h1>
          <p className="text-sm text-muted-foreground">Tournaments, camps, workshops, seminars and demonstrations.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Save event
          </Button>
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Paid event">
            <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
              <input
                type="checkbox"
                {...form.register('isPaid')}
                className="h-4 w-4 accent-primary"
              />
              This event has a fee
            </label>
          </Field>
          <Field label="Description" required error={errors.description?.message} className="sm:col-span-2">
            <Textarea rows={4} {...form.register('description')} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Schedule & venue">
        <FormGrid>
          <Field label="Start" required error={errors.startAt?.message}>
            <Input type="datetime-local" {...form.register('startAt')} />
          </Field>
          <Field label="End" required error={errors.endAt?.message}>
            <Input type="datetime-local" {...form.register('endAt')} />
          </Field>
          <Field label="Venue" required error={errors.venue?.message} className="sm:col-span-2">
            <Input {...form.register('venue')} placeholder="Main hall" />
          </Field>
          <Field label="Address">
            <Input {...form.register('addressLine1')} />
          </Field>
          <Field label="City">
            <Input {...form.register('city')} />
          </Field>
          <Field label="State">
            <Input {...form.register('state')} />
          </Field>
          <Field label="Registration opens">
            <Input type="datetime-local" {...form.register('registrationStartAt')} />
          </Field>
          <Field label="Registration closes">
            <Input type="datetime-local" {...form.register('registrationEndAt')} />
          </Field>
          <Field label="Capacity">
            <Input type="number" min={1} {...form.register('capacity')} />
          </Field>
          <Field label="Fee (₹)">
            <Input type="number" min={0} {...form.register('feePaise')} />
          </Field>
          <Field label="Requires approval" className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                {...form.register('requiresApproval')}
                className="h-4 w-4 accent-primary"
              />
              Manually approve each registration
            </label>
          </Field>
        </FormGrid>
      </FormSection>
    </form>
  );
}

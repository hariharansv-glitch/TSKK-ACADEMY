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
import { Field, FormGrid, FormSection } from '@/components/forms/field';

const schema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6),
  employeeCode: z.string().optional().or(z.literal('')),
  specialization: z.string().optional().or(z.literal('')),
  belt: z.string().optional().or(z.literal('')),
  joiningDate: z.string(),
  bio: z.string().optional().or(z.literal('')),
  salaryPaise: z.coerce.number().int().nonnegative().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function NewInstructorPage() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { joiningDate: new Date().toISOString().slice(0, 10) },
  });
  const errors = form.formState.errors;

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      apiRequest<{ id: string }>({
        method: 'POST',
        url: '/instructors',
        data: {
          ...v,
          employeeCode: v.employeeCode || undefined,
          specialization: v.specialization || undefined,
          belt: v.belt || undefined,
          bio: v.bio || undefined,
        },
      }),
    onSuccess: (i) => {
      toast.success('Instructor added');
      router.push(`/dashboard/instructors/${i.id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not create instructor')),
  });

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/instructors">
              <ArrowLeft className="h-4 w-4" /> Instructors
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Add an instructor</h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Save
          </Button>
        </div>
      </div>

      <FormSection title="Personal">
        <FormGrid>
          <Field label="First name" required error={errors.firstName?.message}>
            <Input {...form.register('firstName')} />
          </Field>
          <Field label="Last name" required error={errors.lastName?.message}>
            <Input {...form.register('lastName')} />
          </Field>
          <Field label="Email" required error={errors.email?.message}>
            <Input type="email" {...form.register('email')} />
          </Field>
          <Field label="Phone" required error={errors.phone?.message}>
            <Input {...form.register('phone')} />
          </Field>
          <Field label="Employee code">
            <Input {...form.register('employeeCode')} />
          </Field>
          <Field label="Joining date" required error={errors.joiningDate?.message}>
            <Input type="date" {...form.register('joiningDate')} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Professional">
        <FormGrid>
          <Field label="Specialization">
            <Input {...form.register('specialization')} placeholder="e.g. Silambam, Weaponry" />
          </Field>
          <Field label="Belt / Rank">
            <Input {...form.register('belt')} placeholder="e.g. BLACK_3" />
          </Field>
          <Field label="Monthly salary (₹)">
            <Input type="number" min={0} {...form.register('salaryPaise')} />
          </Field>
          <Field label="Bio" className="sm:col-span-2">
            <Textarea rows={3} {...form.register('bio')} />
          </Field>
        </FormGrid>
      </FormSection>
    </form>
  );
}

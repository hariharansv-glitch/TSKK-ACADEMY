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
import { Field, FormGrid, FormSection } from '@/components/forms/field';
import { Skeleton } from '@/components/ui/skeleton';

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6),
  employeeCode: z.string().optional().or(z.literal('')),
  specialization: z.string().optional().or(z.literal('')),
  belt: z.string().optional().or(z.literal('')),
  bio: z.string().optional().or(z.literal('')),
  salaryPaise: z.coerce.number().int().nonnegative().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function EditInstructorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const instructor = useQuery({
    queryKey: ['instructor', id],
    queryFn: () => apiRequest<Record<string, unknown>>({ method: 'GET', url: `/instructors/${id}` }),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const errors = form.formState.errors;

  useEffect(() => {
    if (instructor.data) form.reset(instructor.data as unknown as FormValues);
  }, [instructor.data, form]);

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      apiRequest({
        method: 'PATCH',
        url: `/instructors/${id}`,
        data: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === '' ? undefined : val])),
      }),
    onSuccess: () => {
      toast.success('Instructor updated');
      qc.invalidateQueries({ queryKey: ['instructor', id] });
      router.push(`/dashboard/instructors/${id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not update instructor')),
  });

  if (instructor.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href={`/dashboard/instructors/${id}`}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Edit instructor</h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>Save changes</Button>
        </div>
      </div>

      <FormSection title="Personal">
        <FormGrid>
          <Field label="First name" required error={errors.firstName?.message}><Input {...form.register('firstName')} /></Field>
          <Field label="Last name" required error={errors.lastName?.message}><Input {...form.register('lastName')} /></Field>
          <Field label="Email" required error={errors.email?.message}><Input type="email" {...form.register('email')} /></Field>
          <Field label="Phone" required error={errors.phone?.message}><Input {...form.register('phone')} /></Field>
          <Field label="Employee code"><Input {...form.register('employeeCode')} /></Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Professional">
        <FormGrid>
          <Field label="Specialization"><Input {...form.register('specialization')} /></Field>
          <Field label="Belt / Rank"><Input {...form.register('belt')} /></Field>
          <Field label="Monthly salary (₹)"><Input type="number" min={0} {...form.register('salaryPaise')} /></Field>
          <Field label="Bio" className="sm:col-span-2"><Textarea rows={3} {...form.register('bio')} /></Field>
        </FormGrid>
      </FormSection>
    </form>
  );
}

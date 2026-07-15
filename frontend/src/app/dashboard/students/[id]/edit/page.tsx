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

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LEFT', 'SUSPENDED', 'GRADUATED']),
  bloodGroup: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  addressLine1: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  postalCode: z.string().optional().or(z.literal('')),
  emergencyContactName: z.string().optional().or(z.literal('')),
  emergencyContactPhone: z.string().optional().or(z.literal('')),
  medicalConditions: z.string().optional().or(z.literal('')),
  allergies: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

export default function EditStudentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const student = useQuery({
    queryKey: ['student', id],
    queryFn: () => apiRequest<Record<string, unknown>>({ method: 'GET', url: `/students/${id}` }),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const errors = form.formState.errors;

  useEffect(() => {
    if (student.data) form.reset(student.data as unknown as FormValues);
  }, [student.data, form]);

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      apiRequest({
        method: 'PATCH',
        url: `/students/${id}`,
        data: Object.fromEntries(
          Object.entries(values).map(([k, v]) => [k, v === '' ? undefined : v]),
        ),
      }),
    onSuccess: () => {
      toast.success('Student updated');
      qc.invalidateQueries({ queryKey: ['student', id] });
      router.push(`/dashboard/students/${id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not update student')),
  });

  if (student.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href={`/dashboard/students/${id}`}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Edit student</h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Save changes
          </Button>
        </div>
      </div>

      <FormSection title="Profile">
        <FormGrid>
          <Field label="First name" required error={errors.firstName?.message}>
            <Input {...form.register('firstName')} />
          </Field>
          <Field label="Last name" required error={errors.lastName?.message}>
            <Input {...form.register('lastName')} />
          </Field>
          <Field label="Gender" required>
            <Select
              value={form.watch('gender')}
              onValueChange={(v) => form.setValue('gender', v as FormValues['gender'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status" required>
            <Select
              value={form.watch('status')}
              onValueChange={(v) => form.setValue('status', v as FormValues['status'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['ACTIVE', 'INACTIVE', 'LEFT', 'SUSPENDED', 'GRADUATED'].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Blood group">
            <Input {...form.register('bloodGroup')} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Contact">
        <FormGrid>
          <Field label="Email"><Input type="email" {...form.register('email')} /></Field>
          <Field label="Phone"><Input {...form.register('phone')} /></Field>
          <Field label="Address" className="sm:col-span-2"><Input {...form.register('addressLine1')} /></Field>
          <Field label="City"><Input {...form.register('city')} /></Field>
          <Field label="State"><Input {...form.register('state')} /></Field>
          <Field label="Postal code"><Input {...form.register('postalCode')} /></Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Emergency & Medical">
        <FormGrid>
          <Field label="Emergency contact name"><Input {...form.register('emergencyContactName')} /></Field>
          <Field label="Emergency contact phone"><Input {...form.register('emergencyContactPhone')} /></Field>
          <Field label="Medical conditions" className="sm:col-span-2">
            <Textarea rows={3} {...form.register('medicalConditions')} />
          </Field>
          <Field label="Allergies" className="sm:col-span-2">
            <Textarea rows={2} {...form.register('allergies')} />
          </Field>
          <Field label="Internal notes" className="sm:col-span-2">
            <Textarea rows={3} {...form.register('notes')} />
          </Field>
        </FormGrid>
      </FormSection>
    </form>
  );
}

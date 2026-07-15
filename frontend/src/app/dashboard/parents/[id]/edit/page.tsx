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
import { Input } from '@/components/ui/input';
import { Field, FormGrid, FormSection } from '@/components/forms/field';
import { Skeleton } from '@/components/ui/skeleton';

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6),
  alternatePhone: z.string().optional().or(z.literal('')),
  occupation: z.string().optional().or(z.literal('')),
  addressLine1: z.string().optional().or(z.literal('')),
  addressLine2: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  postalCode: z.string().optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

export default function EditParentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const parent = useQuery({
    queryKey: ['parent', id],
    queryFn: () => apiRequest<Record<string, unknown>>({ method: 'GET', url: `/parents/${id}` }),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const errors = form.formState.errors;

  useEffect(() => {
    if (parent.data) form.reset(parent.data as unknown as FormValues);
  }, [parent.data, form]);

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      apiRequest({
        method: 'PATCH',
        url: `/parents/${id}`,
        data: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === '' ? undefined : val])),
      }),
    onSuccess: () => {
      toast.success('Parent updated');
      qc.invalidateQueries({ queryKey: ['parent', id] });
      router.push(`/dashboard/parents/${id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not update parent')),
  });

  if (parent.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href={`/dashboard/parents/${id}`}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Edit parent</h1>
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
          <Field label="Alternate phone"><Input {...form.register('alternatePhone')} /></Field>
          <Field label="Occupation"><Input {...form.register('occupation')} /></Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Address">
        <FormGrid>
          <Field label="Address line 1" className="sm:col-span-2"><Input {...form.register('addressLine1')} /></Field>
          <Field label="Address line 2" className="sm:col-span-2"><Input {...form.register('addressLine2')} /></Field>
          <Field label="City"><Input {...form.register('city')} /></Field>
          <Field label="State"><Input {...form.register('state')} /></Field>
          <Field label="Postal code"><Input {...form.register('postalCode')} /></Field>
        </FormGrid>
      </FormSection>
    </form>
  );
}

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
import { Input } from '@/components/ui/input';
import { Field, FormGrid, FormSection } from '@/components/forms/field';

const schema = z.object({
  firstName: z.string().min(2),
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
  createUserAccount: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function NewParentPage() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { createUserAccount: false },
  });
  const errors = form.formState.errors;

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      apiRequest<{ id: string }>({
        method: 'POST',
        url: '/parents',
        data: {
          ...v,
          alternatePhone: v.alternatePhone || undefined,
          occupation: v.occupation || undefined,
          addressLine1: v.addressLine1 || undefined,
          addressLine2: v.addressLine2 || undefined,
          city: v.city || undefined,
          state: v.state || undefined,
          postalCode: v.postalCode || undefined,
        },
      }),
    onSuccess: (p) => {
      toast.success('Parent added');
      router.push(`/dashboard/parents/${p.id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not create parent')),
  });

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/parents">
              <ArrowLeft className="h-4 w-4" /> Parents
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Add a parent</h1>
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
          <Field label="Alternate phone">
            <Input {...form.register('alternatePhone')} />
          </Field>
          <Field label="Occupation">
            <Input {...form.register('occupation')} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Address">
        <FormGrid>
          <Field label="Address line 1" className="sm:col-span-2">
            <Input {...form.register('addressLine1')} />
          </Field>
          <Field label="Address line 2" className="sm:col-span-2">
            <Input {...form.register('addressLine2')} />
          </Field>
          <Field label="City">
            <Input {...form.register('city')} />
          </Field>
          <Field label="State">
            <Input {...form.register('state')} />
          </Field>
          <Field label="Postal code">
            <Input {...form.register('postalCode')} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Login">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            {...form.register('createUserAccount')}
            className="h-4 w-4 accent-primary"
          />
          Create a login account and send a welcome email with a password-reset link.
        </label>
      </FormSection>
    </form>
  );
}

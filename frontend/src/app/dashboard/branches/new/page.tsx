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
  name: z.string().min(2),
  code: z.string().min(2).max(16),
  addressLine1: z.string().min(3),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

export default function NewBranchPage() {
  const router = useRouter();
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const errors = form.formState.errors;

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      apiRequest<{ id: string }>({
        method: 'POST',
        url: '/branches',
        data: {
          ...v,
          postalCode: v.postalCode || undefined,
          phone: v.phone || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Branch created');
      router.push('/dashboard/branches');
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not create branch')),
  });

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/branches">
              <ArrowLeft className="h-4 w-4" /> Branches
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Add a branch</h1>
        </div>
        <Button type="submit" loading={create.isPending}>
          Save
        </Button>
      </div>

      <FormSection title="Branch details">
        <FormGrid>
          <Field label="Name" required error={errors.name?.message}>
            <Input {...form.register('name')} placeholder="e.g. Chennai - T Nagar" />
          </Field>
          <Field label="Code" required error={errors.code?.message}>
            <Input {...form.register('code')} placeholder="CHN-TN" />
          </Field>
          <Field label="Address" required error={errors.addressLine1?.message} className="sm:col-span-2">
            <Input {...form.register('addressLine1')} />
          </Field>
          <Field label="City" required error={errors.city?.message}>
            <Input {...form.register('city')} />
          </Field>
          <Field label="State" required error={errors.state?.message}>
            <Input {...form.register('state')} />
          </Field>
          <Field label="Postal code">
            <Input {...form.register('postalCode')} />
          </Field>
          <Field label="Phone">
            <Input {...form.register('phone')} />
          </Field>
        </FormGrid>
      </FormSection>
    </form>
  );
}

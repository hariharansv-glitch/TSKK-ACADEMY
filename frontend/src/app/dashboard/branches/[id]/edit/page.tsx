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
  name: z.string().min(1),
  code: z.string().min(1),
  addressLine1: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

export default function EditBranchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const branch = useQuery({
    queryKey: ['branch', id],
    queryFn: () => apiRequest<Record<string, unknown>>({ method: 'GET', url: `/branches/${id}` }),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (branch.data) form.reset(branch.data as unknown as FormValues);
  }, [branch.data, form]);

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      apiRequest({
        method: 'PATCH',
        url: `/branches/${id}`,
        data: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === '' ? undefined : val])),
      }),
    onSuccess: () => {
      toast.success('Branch updated');
      qc.invalidateQueries({ queryKey: ['branch', id] });
      router.push('/dashboard/branches');
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not update branch')),
  });

  if (branch.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/branches">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Edit branch</h1>
        </div>
        <Button type="submit" loading={save.isPending}>Save changes</Button>
      </div>

      <FormSection title="Branch details">
        <FormGrid>
          <Field label="Name" required><Input {...form.register('name')} /></Field>
          <Field label="Code" required><Input {...form.register('code')} /></Field>
          <Field label="Address" required className="sm:col-span-2"><Input {...form.register('addressLine1')} /></Field>
          <Field label="City" required><Input {...form.register('city')} /></Field>
          <Field label="State" required><Input {...form.register('state')} /></Field>
          <Field label="Postal code"><Input {...form.register('postalCode')} /></Field>
          <Field label="Phone"><Input {...form.register('phone')} /></Field>
        </FormGrid>
      </FormSection>
    </form>
  );
}

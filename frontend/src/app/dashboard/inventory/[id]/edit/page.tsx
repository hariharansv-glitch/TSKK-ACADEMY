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
  name: z.string().min(1),
  sku: z.string().min(1),
  description: z.string().optional().or(z.literal('')),
  pricePaise: z.coerce.number().int().nonnegative(),
  reorderLevel: z.coerce.number().int().nonnegative().optional(),
  category: z.string().optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

export default function EditInventoryItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const item = useQuery({
    queryKey: ['inventory-item', id],
    queryFn: () => apiRequest<Record<string, unknown>>({ method: 'GET', url: `/inventory/items/${id}` }),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (item.data) form.reset(item.data as unknown as FormValues);
  }, [item.data, form]);

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      apiRequest({
        method: 'PATCH',
        url: `/inventory/items/${id}`,
        data: {
          ...v,
          description: v.description || undefined,
          category: v.category || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Item updated');
      qc.invalidateQueries({ queryKey: ['inventory-item', id] });
      router.push(`/dashboard/inventory/${id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not update item')),
  });

  if (item.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href={`/dashboard/inventory/${id}`}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Edit item</h1>
        </div>
        <Button type="submit" loading={save.isPending}>Save changes</Button>
      </div>

      <FormSection title="Item details">
        <FormGrid>
          <Field label="Name" required><Input {...form.register('name')} /></Field>
          <Field label="SKU" required><Input {...form.register('sku')} /></Field>
          <Field label="Category"><Input {...form.register('category')} /></Field>
          <Field label="Price (₹)" required><Input type="number" min={0} {...form.register('pricePaise')} /></Field>
          <Field label="Reorder level"><Input type="number" min={0} {...form.register('reorderLevel')} /></Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={3} {...form.register('description')} />
          </Field>
        </FormGrid>
      </FormSection>
    </form>
  );
}

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
  name: z.string().min(2),
  sku: z.string().min(2),
  description: z.string().optional().or(z.literal('')),
  pricePaise: z.coerce.number().int().nonnegative(),
  stockQuantity: z.coerce.number().int().nonnegative(),
  reorderLevel: z.coerce.number().int().nonnegative().optional(),
  category: z.string().optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

export default function NewInventoryItemPage() {
  const router = useRouter();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { stockQuantity: 0, pricePaise: 0 } });
  const errors = form.formState.errors;

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      apiRequest<{ id: string }>({
        method: 'POST',
        url: '/inventory/items',
        data: {
          ...v,
          description: v.description || undefined,
          category: v.category || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Item added');
      router.push('/dashboard/inventory');
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not add item')),
  });

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/inventory">
              <ArrowLeft className="h-4 w-4" /> Inventory
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Add inventory item</h1>
        </div>
        <Button type="submit" loading={create.isPending}>
          Save
        </Button>
      </div>
      <FormSection title="Item details">
        <FormGrid>
          <Field label="Name" required error={errors.name?.message}>
            <Input {...form.register('name')} placeholder="Silambam stick" />
          </Field>
          <Field label="SKU" required error={errors.sku?.message}>
            <Input {...form.register('sku')} placeholder="STK-STD-01" />
          </Field>
          <Field label="Category">
            <Input {...form.register('category')} placeholder="Uniform / Equipment / Merch" />
          </Field>
          <Field label="Price (₹)" required error={errors.pricePaise?.message}>
            <Input type="number" min={0} {...form.register('pricePaise')} />
          </Field>
          <Field label="Opening stock" required error={errors.stockQuantity?.message}>
            <Input type="number" min={0} {...form.register('stockQuantity')} />
          </Field>
          <Field label="Reorder level">
            <Input type="number" min={0} {...form.register('reorderLevel')} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={3} {...form.register('description')} />
          </Field>
        </FormGrid>
      </FormSection>
    </form>
  );
}

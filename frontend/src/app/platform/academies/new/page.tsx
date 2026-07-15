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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FormGrid, FormSection } from '@/components/forms/field';

const DISCIPLINES = ['SILAMBAM', 'KARATE', 'MARTIAL_ARTS', 'YOGA', 'DANCE', 'MUSIC', 'CHESS', 'FITNESS', 'OTHER'];
const PLANS = ['STARTER', 'GROWTH', 'ENTERPRISE', 'CUSTOM'];

const schema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/i).optional().or(z.literal('')),
  discipline: z.string(),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(6),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  addressLine1: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(3),
  country: z.string().min(2),
  admin: z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional().or(z.literal('')),
  }),
  subscription: z.object({
    plan: z.string(),
    seatLimit: z.coerce.number().int().min(1),
    trialDays: z.coerce.number().int().min(0),
  }),
});
type FormValues = z.infer<typeof schema>;

export default function NewAcademyPage() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      discipline: 'SILAMBAM',
      country: 'India',
      subscription: { plan: 'STARTER', seatLimit: 50, trialDays: 14 },
      admin: { email: '', firstName: '', lastName: '', phone: '' },
    },
  });
  const errors = form.formState.errors;

  const create = useMutation({
    mutationFn: (v: FormValues) => {
      const payload = {
        ...v,
        slug: v.slug || undefined,
        websiteUrl: v.websiteUrl || undefined,
        admin: { ...v.admin, phone: v.admin.phone || undefined, sendInvite: true },
      };
      return apiRequest<{ id: string }>({ method: 'POST', url: '/academies', data: payload });
    },
    onSuccess: (row) => {
      toast.success('Academy created');
      router.push(`/platform/academies/${row.id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not create academy')),
  });

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/platform/academies"><ArrowLeft className="h-4 w-4" /> Academies</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">New academy</h1>
        </div>
        <Button type="submit" loading={create.isPending}>Create academy</Button>
      </div>

      <FormSection title="Basics">
        <FormGrid>
          <Field label="Name" required error={errors.name?.message} className="sm:col-span-2">
            <Input {...form.register('name')} />
          </Field>
          <Field label="Slug (URL id)" hint="Lowercase, letters and dashes only. Auto-generated if empty.">
            <Input placeholder="tskk-chennai" {...form.register('slug')} />
          </Field>
          <Field label="Discipline" required>
            <Select value={form.watch('discipline')} onValueChange={(v) => form.setValue('discipline', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DISCIPLINES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Contact email" required error={errors.contactEmail?.message}>
            <Input type="email" {...form.register('contactEmail')} />
          </Field>
          <Field label="Contact phone" required error={errors.contactPhone?.message}>
            <Input {...form.register('contactPhone')} />
          </Field>
          <Field label="Website">
            <Input {...form.register('websiteUrl')} placeholder="https://" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Address">
        <FormGrid>
          <Field label="Address line 1" required className="sm:col-span-2"><Input {...form.register('addressLine1')} /></Field>
          <Field label="City" required><Input {...form.register('city')} /></Field>
          <Field label="State" required><Input {...form.register('state')} /></Field>
          <Field label="Postal code" required><Input {...form.register('postalCode')} /></Field>
          <Field label="Country" required><Input {...form.register('country')} /></Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Admin user" description="A user account with ACADEMY_ADMIN role will be created.">
        <FormGrid>
          <Field label="First name" required><Input {...form.register('admin.firstName')} /></Field>
          <Field label="Last name" required><Input {...form.register('admin.lastName')} /></Field>
          <Field label="Email" required><Input type="email" {...form.register('admin.email')} /></Field>
          <Field label="Phone"><Input {...form.register('admin.phone')} /></Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Subscription">
        <FormGrid>
          <Field label="Plan">
            <Select
              value={form.watch('subscription.plan')}
              onValueChange={(v) => form.setValue('subscription.plan', v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PLANS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Seat limit"><Input type="number" min={1} {...form.register('subscription.seatLimit')} /></Field>
          <Field label="Trial days"><Input type="number" min={0} {...form.register('subscription.trialDays')} /></Field>
        </FormGrid>
      </FormSection>
    </form>
  );
}

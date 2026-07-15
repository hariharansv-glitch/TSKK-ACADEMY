'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FormGrid, FormSection } from '@/components/forms/field';

const schema = z.object({
  title: z.string().min(3),
  body: z.string().min(10),
  audience: z.enum(['ALL', 'STUDENTS', 'PARENTS', 'STAFF', 'INSTRUCTORS']),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  expiresAt: z.string().optional().or(z.literal('')),
  channels: z.array(z.enum(['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'])).min(1),
});
type FormValues = z.infer<typeof schema>;

const CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] as const;

export default function NewAnnouncementPage() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { audience: 'ALL', priority: 'NORMAL', channels: ['IN_APP', 'EMAIL'] },
  });
  const errors = form.formState.errors;
  const channels = form.watch('channels');

  const toggleChannel = (c: (typeof CHANNELS)[number]) => {
    const current = form.getValues('channels');
    form.setValue(
      'channels',
      current.includes(c) ? current.filter((x) => x !== c) : [...current, c],
    );
  };

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      apiRequest({
        method: 'POST',
        url: '/announcements',
        data: {
          ...v,
          expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString() : undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Announcement published');
      router.push('/dashboard/announcements');
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not publish announcement')),
  });

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/announcements">
              <ArrowLeft className="h-4 w-4" /> Announcements
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">New announcement</h1>
        </div>
        <Button type="submit" loading={create.isPending}>
          <Send className="h-4 w-4" /> Publish
        </Button>
      </div>

      <FormSection title="Content">
        <FormGrid>
          <Field label="Title" required error={errors.title?.message} className="sm:col-span-2">
            <Input {...form.register('title')} />
          </Field>
          <Field label="Message" required error={errors.body?.message} className="sm:col-span-2">
            <Textarea rows={6} {...form.register('body')} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Delivery">
        <FormGrid>
          <Field label="Audience" required>
            <Select
              value={form.watch('audience')}
              onValueChange={(v) => form.setValue('audience', v as FormValues['audience'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['ALL', 'STUDENTS', 'PARENTS', 'STAFF', 'INSTRUCTORS'].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Priority" required>
            <Select
              value={form.watch('priority')}
              onValueChange={(v) => form.setValue('priority', v as FormValues['priority'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Expires at (optional)" className="sm:col-span-2">
            <Input type="datetime-local" {...form.register('expiresAt')} />
          </Field>
          <Field label="Channels" required error={errors.channels?.message} className="sm:col-span-2">
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => toggleChannel(c)}
                  className={
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                    (channels.includes(c)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'hover:bg-accent')
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
        </FormGrid>
      </FormSection>
    </form>
  );
}

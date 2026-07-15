'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Monitor, Save, Users2 } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Settings {
  autoLateFeeEnabled: boolean;
  autoReceiptEnabled: boolean;
  autoAttendanceReminderEnabled: boolean;
  autoFeeReminderEnabled: boolean;
  birthdayWishesEnabled: boolean;
  defaultTaxPercent: number;
  invoicePrefix: string;
  receiptPrefix: string;
  certificatePrefix: string;
  studentCodePrefix: string;
  employeeCodePrefix: string;
  qrCheckInWindowMinutes: number;
  attendanceLateAfterMinutes: number;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiRequest<Settings>({ method: 'GET', url: '/settings' }),
  });
  const [form, setForm] = useState<Partial<Settings>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutate = useMutation({
    mutationFn: (values: Partial<Settings>) =>
      apiRequest<Settings>({ method: 'PATCH', url: '/settings', data: values }),
    onSuccess: () => {
      toast.success('Settings saved.');
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  if (isLoading || !data) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Academy settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure automation, prefixes, notification channels and attendance thresholds.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/settings/users"><Users2 className="h-4 w-4" /> Users</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/settings/sessions"><Monitor className="h-4 w-4" /> My sessions</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Automation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Toggle
              label="Apply late fees automatically on overdue invoices"
              checked={form.autoLateFeeEnabled ?? true}
              onChange={(v) => setForm((f) => ({ ...f, autoLateFeeEnabled: v }))}
            />
            <Toggle
              label="Send receipts automatically after payment"
              checked={form.autoReceiptEnabled ?? true}
              onChange={(v) => setForm((f) => ({ ...f, autoReceiptEnabled: v }))}
            />
            <Toggle
              label="Send attendance reminders"
              checked={form.autoAttendanceReminderEnabled ?? true}
              onChange={(v) => setForm((f) => ({ ...f, autoAttendanceReminderEnabled: v }))}
            />
            <Toggle
              label="Send fee-due reminders"
              checked={form.autoFeeReminderEnabled ?? true}
              onChange={(v) => setForm((f) => ({ ...f, autoFeeReminderEnabled: v }))}
            />
            <Toggle
              label="Send birthday wishes to students"
              checked={form.birthdayWishesEnabled ?? true}
              onChange={(v) => setForm((f) => ({ ...f, birthdayWishesEnabled: v }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification channels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Toggle
              label="Email"
              checked={form.emailEnabled ?? true}
              onChange={(v) => setForm((f) => ({ ...f, emailEnabled: v }))}
            />
            <Toggle
              label="SMS (Twilio)"
              checked={form.smsEnabled ?? false}
              onChange={(v) => setForm((f) => ({ ...f, smsEnabled: v }))}
            />
            <Toggle
              label="WhatsApp"
              checked={form.whatsappEnabled ?? false}
              onChange={(v) => setForm((f) => ({ ...f, whatsappEnabled: v }))}
            />
            <Toggle
              label="Web push"
              checked={form.pushEnabled ?? true}
              onChange={(v) => setForm((f) => ({ ...f, pushEnabled: v }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Numbering prefixes</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <TextField
              label="Invoice"
              value={form.invoicePrefix ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, invoicePrefix: v }))}
            />
            <TextField
              label="Receipt"
              value={form.receiptPrefix ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, receiptPrefix: v }))}
            />
            <TextField
              label="Certificate"
              value={form.certificatePrefix ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, certificatePrefix: v }))}
            />
            <TextField
              label="Student code"
              value={form.studentCodePrefix ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, studentCodePrefix: v }))}
            />
            <TextField
              label="Employee code"
              value={form.employeeCodePrefix ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, employeeCodePrefix: v }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance & finance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <NumberField
              label="QR check-in window (min)"
              value={form.qrCheckInWindowMinutes ?? 30}
              onChange={(v) => setForm((f) => ({ ...f, qrCheckInWindowMinutes: v }))}
            />
            <NumberField
              label="Late after (min)"
              value={form.attendanceLateAfterMinutes ?? 10}
              onChange={(v) => setForm((f) => ({ ...f, attendanceLateAfterMinutes: v }))}
            />
            <NumberField
              label="Default tax (%)"
              value={form.defaultTaxPercent ?? 0}
              onChange={(v) => setForm((f) => ({ ...f, defaultTaxPercent: v }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => mutate.mutate(form)} loading={mutate.isPending}>
          <Save className="h-4 w-4" /> Save changes
        </Button>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-primary"
      />
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value.toUpperCase().slice(0, 10))} />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import { toast } from 'sonner';

import { apiListRequest, apiRequest, extractErrorMessage } from '@/lib/api-client';
import { useDebouncedValue } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FormGrid } from '@/components/forms/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatINR } from '@/lib/utils';

const FEE_TYPES = ['ADMISSION', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'EVENT', 'EXAM', 'UNIFORM', 'EQUIPMENT', 'OTHER'];

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [studentSearch, setStudentSearch] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [type, setType] = useState('MONTHLY');
  const [amount, setAmount] = useState('1000');
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [scholarshipReason, setScholarshipReason] = useState('');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const debounced = useDebouncedValue(studentSearch, 300);
  const searchQuery = useQuery({
    queryKey: ['students-fee-search', debounced],
    queryFn: () =>
      apiListRequest<StudentRow>({
        method: 'GET',
        url: '/students',
        params: { search: debounced || undefined, pageSize: 8 },
      }),
    enabled: debounced.length > 0,
  });
  const selected = searchQuery.data?.items.find((s) => s.id === studentId);

  const total = useMemo(() => {
    const a = Number(amount) || 0;
    const d = Number(discount) || 0;
    const t = Number(tax) || 0;
    return Math.max(0, a - d + t);
  }, [amount, discount, tax]);

  const create = useMutation({
    mutationFn: () =>
      apiRequest<{ id: string }>({
        method: 'POST',
        url: '/fees/invoices',
        data: {
          studentId,
          type,
          amountPaise: Math.round(Number(amount) * 100),
          discountPaise: Math.round(Number(discount) * 100),
          taxPaise: Math.round(Number(tax) * 100),
          scholarshipReason: scholarshipReason || undefined,
          dueDate,
          notes: notes || undefined,
        },
      }),
    onSuccess: (inv) => {
      toast.success('Invoice created');
      router.push(`/dashboard/fees/${inv.id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not create invoice')),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/fees">
              <ArrowLeft className="h-4 w-4" /> Invoices
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Create invoice</h1>
          <p className="text-sm text-muted-foreground">Bill a student for tuition, exam fees, or merchandise.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button disabled={!studentId} loading={create.isPending} onClick={() => create.mutate()}>
            Save invoice
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Student</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name or code…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border">
              {searchQuery.data?.items.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setStudentId(s.id)}
                  className={
                    'flex w-full items-center justify-between border-b p-3 text-left text-sm last:border-0 hover:bg-accent ' +
                    (studentId === s.id ? 'bg-accent' : '')
                  }
                >
                  <span className="font-medium">
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{s.studentCode}</span>
                </button>
              ))}
              {!searchQuery.data && (
                <p className="p-6 text-center text-sm text-muted-foreground">Type to search students.</p>
              )}
            </div>
            {selected && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                Billing to:{' '}
                <span className="font-medium">
                  {selected.firstName} {selected.lastName}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice details</CardTitle>
          </CardHeader>
          <CardContent>
            <FormGrid>
              <Field label="Fee type" required>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replaceAll('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Due date" required>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
              <Field label="Amount (₹)" required>
                <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <Field label="Discount (₹)">
                <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </Field>
              <Field label="Tax (₹)">
                <Input type="number" min={0} value={tax} onChange={(e) => setTax(e.target.value)} />
              </Field>
              <Field label="Scholarship reason (if discount applied)">
                <Input
                  value={scholarshipReason}
                  onChange={(e) => setScholarshipReason(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </FormGrid>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex items-center justify-end gap-6 p-6 text-right">
          <div>
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-3xl font-bold">{formatINR(total)}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

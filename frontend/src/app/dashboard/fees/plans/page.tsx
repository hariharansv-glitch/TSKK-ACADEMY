'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { apiListRequest, apiRequest, extractErrorMessage } from '@/lib/api-client';
import { formatINR } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FormGrid } from '@/components/forms/field';
import { Skeleton } from '@/components/ui/skeleton';

const FEE_TYPES = ['ADMISSION', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'EVENT', 'EXAM', 'UNIFORM', 'EQUIPMENT', 'OTHER'];

interface FeePlan {
  id: string;
  name: string;
  description?: string;
  type: string;
  amountPaise: number;
  billingCycleMonths: number;
  gracePeriodDays: number;
  lateFeePaise: number;
  isActive: boolean;
}

export default function FeePlansPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['fee-plans'],
    queryFn: () => apiListRequest<FeePlan>({ method: 'GET', url: '/fees/plans', params: { pageSize: 100 } }),
  });

  const [editing, setEditing] = useState<FeePlan | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'MONTHLY',
    amount: '1000',
    billingCycleMonths: 1,
    gracePeriodDays: 7,
    lateFeePaise: '0',
    isActive: true,
  });

  const startEdit = (p?: FeePlan) => {
    if (p) {
      setForm({
        name: p.name,
        description: p.description ?? '',
        type: p.type,
        amount: String(p.amountPaise / 100),
        billingCycleMonths: p.billingCycleMonths,
        gracePeriodDays: p.gracePeriodDays,
        lateFeePaise: String(p.lateFeePaise / 100),
        isActive: p.isActive,
      });
      setEditing(p);
    } else {
      setForm({ name: '', description: '', type: 'MONTHLY', amount: '1000', billingCycleMonths: 1, gracePeriodDays: 7, lateFeePaise: '0', isActive: true });
      setEditing({ id: '__new__' } as FeePlan);
    }
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        type: form.type,
        amountPaise: Math.round(Number(form.amount) * 100),
        billingCycleMonths: form.billingCycleMonths,
        gracePeriodDays: form.gracePeriodDays,
        lateFeePaise: Math.round(Number(form.lateFeePaise) * 100),
        isActive: form.isActive,
      };
      if (editing?.id === '__new__') {
        return apiRequest({ method: 'POST', url: '/fees/plans', data: payload });
      }
      return apiRequest({ method: 'PATCH', url: `/fees/plans/${editing?.id}`, data: payload });
    },
    onSuccess: () => {
      toast.success('Fee plan saved');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['fee-plans'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not save fee plan')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest({ method: 'DELETE', url: `/fees/plans/${id}` }),
    onSuccess: () => {
      toast.success('Fee plan deleted');
      qc.invalidateQueries({ queryKey: ['fee-plans'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not delete')),
  });

  const toggle = useMutation({
    mutationFn: (p: FeePlan) =>
      apiRequest({ method: 'PATCH', url: `/fees/plans/${p.id}`, data: { isActive: !p.isActive } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fee-plans'] }),
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
          <h1 className="text-3xl font-bold tracking-tight">Fee plans</h1>
          <p className="text-sm text-muted-foreground">Templates used to generate invoices in bulk.</p>
        </div>
        <Button onClick={() => startEdit()}>
          <Plus className="h-4 w-4" /> New plan
        </Button>
      </div>

      {list.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.data?.items.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{p.description ?? '—'}</p>
                </div>
                <Badge variant={p.isActive ? 'success' : 'muted'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">{formatINR(p.amountPaise / 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span>{p.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cycle</span>
                  <span>{p.billingCycleMonths} month(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Grace</span>
                  <span>{p.gracePeriodDays} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Late fee</span>
                  <span>{formatINR(p.lateFeePaise / 100)}</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate(p)}>
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Delete ${p.name}?`)) remove.mutate(p.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {list.data?.items.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No fee plans yet. Create one to standardise your billing.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>{editing.id === '__new__' ? 'New fee plan' : 'Edit fee plan'}</CardTitle>
          </CardHeader>
          <CardContent>
            <FormGrid>
              <Field label="Name" required className="sm:col-span-2">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Type" required>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FEE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Amount (₹)" required>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </Field>
              <Field label="Billing cycle (months)" required>
                <Input
                  type="number"
                  min={0}
                  value={form.billingCycleMonths}
                  onChange={(e) => setForm({ ...form, billingCycleMonths: Number(e.target.value) })}
                />
              </Field>
              <Field label="Grace period (days)" required>
                <Input
                  type="number"
                  min={0}
                  value={form.gracePeriodDays}
                  onChange={(e) => setForm({ ...form, gracePeriodDays: Number(e.target.value) })}
                />
              </Field>
              <Field label="Late fee (₹)">
                <Input type="number" value={form.lateFeePaise} onChange={(e) => setForm({ ...form, lateFeePaise: e.target.value })} />
              </Field>
              <Field label="Active" className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  Available for use
                </label>
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </FormGrid>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button loading={save.isPending} onClick={() => save.mutate()}>
                {editing.id === '__new__' ? 'Create plan' : 'Save changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

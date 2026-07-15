'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { apiListRequest, apiRequest, extractErrorMessage } from '@/lib/api-client';
import { formatINR } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/forms/field';
import { Skeleton } from '@/components/ui/skeleton';

interface Item {
  id: string;
  name: string;
  sku: string;
  pricePaise: number;
  stockQty: number;
  reorderLevel: number;
  category?: string | null;
}

interface StudentOption {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
}

export default function NewOrderPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [student, setStudent] = useState<StudentOption | null>(null);
  const [cart, setCart] = useState<Record<string, { item: Item; qty: number }>>({});
  const [taxPercent, setTaxPercent] = useState('0');
  const [notes, setNotes] = useState('');

  const items = useQuery({
    queryKey: ['inventory-items', search],
    queryFn: () =>
      apiListRequest<Item>({
        method: 'GET',
        url: '/inventory/items',
        params: { search: search || undefined, pageSize: 40 },
      }),
  });

  const students = useQuery({
    queryKey: ['student-search', studentSearch],
    queryFn: () =>
      apiListRequest<StudentOption>({
        method: 'GET',
        url: '/students',
        params: { search: studentSearch, pageSize: 6, status: 'ACTIVE' },
      }),
    enabled: studentSearch.length >= 2,
  });

  const addToCart = (item: Item) => {
    setCart((prev) => {
      const line = prev[item.id];
      if (line && line.qty >= item.stockQty) return prev;
      return { ...prev, [item.id]: { item, qty: (line?.qty ?? 0) + 1 } };
    });
  };
  const dec = (id: string) => {
    setCart((prev) => {
      const line = prev[id];
      if (!line) return prev;
      const next = { ...prev };
      if (line.qty <= 1) delete next[id];
      else next[id] = { ...line, qty: line.qty - 1 };
      return next;
    });
  };
  const removeLine = (id: string) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const totals = useMemo(() => {
    const subtotalPaise = Object.values(cart).reduce((sum, l) => sum + l.item.pricePaise * l.qty, 0);
    const taxPaise = Math.round((subtotalPaise * (Number(taxPercent) || 0)) / 100);
    return { subtotalPaise, taxPaise, totalPaise: subtotalPaise + taxPaise };
  }, [cart, taxPercent]);

  const create = useMutation({
    mutationFn: () =>
      apiRequest<{ id: string }>({
        method: 'POST',
        url: '/inventory/orders',
        data: {
          studentId: student?.id,
          items: Object.values(cart).map((l) => ({ itemId: l.item.id, quantity: l.qty })),
          taxPaise: totals.taxPaise,
          notes: notes || undefined,
        },
      }),
    onSuccess: (row) => {
      toast.success('Order created');
      router.push(`/dashboard/inventory/orders/${row.id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not create order')),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/inventory/orders"><ArrowLeft className="h-4 w-4" /> Orders</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">New order</h1>
          <p className="text-sm text-muted-foreground">Quick POS for uniforms and gear.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Input placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {items.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.data?.items.map((it) => (
                <Card key={it.id} className={it.stockQty === 0 ? 'opacity-60' : 'transition-colors hover:border-primary/60'}>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-base">{it.name}</CardTitle>
                    <p className="font-mono text-xs text-muted-foreground">{it.sku}</p>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold">{formatINR(it.pricePaise / 100)}</p>
                      <Badge variant={it.stockQty > it.reorderLevel ? 'muted' : it.stockQty === 0 ? 'destructive' : 'warning'}>
                        {it.stockQty} in stock
                      </Badge>
                    </div>
                    <Button size="sm" onClick={() => addToCart(it)} disabled={it.stockQty === 0}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Cart</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Field label="Student (optional)" hint="Leave blank for walk-in customers.">
                <Input placeholder="Search by name/code" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
              </Field>
              {studentSearch.length >= 2 && !student && (
                <div className="mt-1 space-y-1 rounded-md border bg-background p-2 text-sm">
                  {students.data?.items.length === 0 ? (
                    <p className="text-muted-foreground">No matches</p>
                  ) : (
                    students.data?.items.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="block w-full rounded px-2 py-1 text-left hover:bg-muted"
                        onClick={() => { setStudent(s); setStudentSearch(''); }}
                      >
                        {s.firstName} {s.lastName} <span className="text-muted-foreground">({s.studentCode})</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {student && (
                <div className="mt-1 flex items-center justify-between rounded-md border bg-muted/40 px-3 py-1 text-sm">
                  <span>{student.firstName} {student.lastName}</span>
                  <Button size="sm" variant="ghost" onClick={() => setStudent(null)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>

            <div className="divide-y rounded-md border">
              {Object.values(cart).length === 0 && (
                <p className="p-3 text-center text-sm text-muted-foreground">No items yet.</p>
              )}
              {Object.values(cart).map((line) => (
                <div key={line.item.id} className="flex items-center justify-between p-2 text-sm">
                  <div>
                    <p className="font-medium">{line.item.name}</p>
                    <p className="text-xs text-muted-foreground">{formatINR(line.item.pricePaise / 100)} × {line.qty}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => dec(line.item.id)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-8 text-center text-sm">{line.qty}</span>
                    <Button size="icon" variant="ghost" onClick={() => addToCart(line.item)} disabled={line.qty >= line.item.stockQty}><Plus className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => removeLine(line.item.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatINR(totals.subtotalPaise / 100)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tax %</span>
                <Input type="number" min={0} className="h-8 w-20 text-right" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatINR(totals.totalPaise / 100)}</span>
              </div>
            </div>

            <Textarea rows={2} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

            <Button
              className="w-full"
              disabled={Object.values(cart).length === 0}
              loading={create.isPending}
              onClick={() => create.mutate()}
            >
              Create order
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

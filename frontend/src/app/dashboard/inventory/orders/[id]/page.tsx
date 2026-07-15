'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { formatDate, formatINR } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const STATUSES = ['DRAFT', 'CONFIRMED', 'FULFILLED', 'CANCELLED', 'REFUNDED'];

interface OrderItem {
  id: string;
  quantity: number;
  unitPricePaise: number;
  subtotalPaise: number;
  item: { id: string; name: string; sku: string };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  notes?: string;
  createdAt: string;
  student?: { id: string; firstName: string; lastName: string; studentCode: string } | null;
  items: OrderItem[];
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const order = useQuery({
    queryKey: ['order', id],
    queryFn: () => apiRequest<Order>({ method: 'GET', url: `/inventory/orders/${id}` }),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      apiRequest({ method: 'PATCH', url: `/inventory/orders/${id}/status`, data: { status } }),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  if (order.isLoading || !order.data) return <Skeleton className="h-64 w-full" />;
  const o = order.data;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
          <Link href="/dashboard/inventory/orders"><ArrowLeft className="h-4 w-4" /> Orders</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold">{o.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(o.createdAt)} · {o.student ? `${o.student.firstName} ${o.student.lastName}` : 'Walk-in'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={
              o.status === 'FULFILLED' ? 'success' :
              o.status === 'CANCELLED' || o.status === 'REFUNDED' ? 'destructive' :
              o.status === 'CONFIRMED' ? 'info' : 'muted'
            }>{o.status}</Badge>
            <Select value={o.status} onValueChange={(v) => updateStatus.mutate(v)}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-3xl font-bold">{formatINR(o.totalPaise / 100)}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Line items</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {o.items.map((line) => (
            <div key={line.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <p className="font-medium">{line.item.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{line.item.sku}</p>
              </div>
              <div className="text-right">
                <p>{formatINR(line.unitPricePaise / 100)} × {line.quantity}</p>
                <p className="font-semibold">{formatINR(line.subtotalPaise / 100)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-right">{formatINR(o.subtotalPaise / 100)}</span>
          <span className="text-muted-foreground">Tax</span>
          <span className="text-right">{formatINR(o.taxPaise / 100)}</span>
          <span className="font-semibold">Total</span>
          <span className="text-right font-semibold">{formatINR(o.totalPaise / 100)}</span>
        </CardContent>
      </Card>

      {o.notes && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap text-sm">{o.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}

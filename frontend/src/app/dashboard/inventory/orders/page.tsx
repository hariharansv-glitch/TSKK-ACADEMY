'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react';

import { apiListRequest } from '@/lib/api-client';
import { formatDate, formatINR } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const STATUSES = ['DRAFT', 'CONFIRMED', 'FULFILLED', 'CANCELLED', 'REFUNDED'];

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  totalPaise: number;
  createdAt: string;
  student?: { firstName: string; lastName: string } | null;
  _count?: { items: number };
}

export default function OrdersListPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const list = useQuery({
    queryKey: ['orders', status],
    queryFn: () =>
      apiListRequest<OrderRow>({
        method: 'GET',
        url: '/inventory/orders',
        params: { status, pageSize: 50 },
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/inventory"><ArrowLeft className="h-4 w-4" /> Inventory</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">Sales of uniforms, gear and merchandise.</p>
        </div>
        <div className="flex gap-2">
          <Select value={status ?? 'all'} onValueChange={(v) => setStatus(v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button asChild><Link href="/dashboard/inventory/orders/new"><Plus className="h-4 w-4" /> New order</Link></Button>
        </div>
      </div>

      {list.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-2">
          {list.data?.items.length === 0 && (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No orders yet.</CardContent></Card>
          )}
          {list.data?.items.map((o) => (
            <Link key={o.id} href={`/dashboard/inventory/orders/${o.id}`}>
              <Card className="transition-colors hover:border-primary/60">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                  <div>
                    <CardTitle className="text-base font-mono">{o.orderNumber}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(o.createdAt)} · {o.student ? `${o.student.firstName} ${o.student.lastName}` : 'Walk-in'} · {o._count?.items ?? 0} item(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{formatINR(o.totalPaise / 100)}</span>
                    <Badge variant={
                      o.status === 'FULFILLED' ? 'success' :
                      o.status === 'CANCELLED' || o.status === 'REFUNDED' ? 'destructive' :
                      o.status === 'CONFIRMED' ? 'info' : 'muted'
                    }>{o.status}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

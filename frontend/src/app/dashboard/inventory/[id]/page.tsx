'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Package } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Field, FormGrid } from '@/components/forms/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatINR } from '@/lib/utils';

interface Item {
  id: string;
  name: string;
  sku: string;
  description?: string;
  pricePaise: number;
  stockQuantity: number;
  reorderLevel?: number;
  category?: string;
}

export default function InventoryItemPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [reason, setReason] = useState('MANUAL');
  const [delta, setDelta] = useState('0');
  const [note, setNote] = useState('');

  const item = useQuery({
    queryKey: ['inventory-item', id],
    queryFn: () => apiRequest<Item>({ method: 'GET', url: `/inventory/items/${id}` }),
  });

  const adjust = useMutation({
    mutationFn: () =>
      apiRequest({
        method: 'POST',
        url: `/inventory/items/${id}/adjust`,
        data: { delta: Number(delta), reason, note: note || undefined },
      }),
    onSuccess: () => {
      toast.success('Stock adjusted');
      setDelta('0');
      setNote('');
      qc.invalidateQueries({ queryKey: ['inventory-item', id] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not adjust stock')),
  });

  if (item.isLoading || !item.data) return <Skeleton className="h-48 w-full" />;
  const i = item.data;
  const lowStock = i.reorderLevel != null && i.stockQuantity <= i.reorderLevel;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
          <Link href="/dashboard/inventory">
            <ArrowLeft className="h-4 w-4" /> Inventory
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-md border bg-muted/50 p-3">
              <Package className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{i.name}</h1>
              <p className="font-mono text-xs text-muted-foreground">{i.sku}</p>
              {i.category && <Badge variant="muted" className="mt-1">{i.category}</Badge>}
              {i.description && <p className="mt-2 max-w-md text-sm">{i.description}</p>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Price</div>
            <div className="text-2xl font-bold">{formatINR(i.pricePaise / 100)}</div>
            <div className="mt-1 text-sm">
              Stock <span className={lowStock ? 'font-semibold text-destructive' : 'font-semibold'}>{i.stockQuantity}</span>
              {i.reorderLevel != null && ` (reorder at ${i.reorderLevel})`}
            </div>
            {lowStock && (
              <Badge variant="destructive" className="mt-1">
                Low stock
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Adjust stock</CardTitle>
        </CardHeader>
        <CardContent>
          <FormGrid>
            <Field label="Delta (positive to add, negative to remove)" required>
              <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} />
            </Field>
            <Field label="Reason" required>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="PURCHASE">Purchase / Restock</SelectItem>
                  <SelectItem value="DAMAGE">Damage / Loss</SelectItem>
                  <SelectItem value="RETURN">Return</SelectItem>
                  <SelectItem value="AUDIT">Audit correction</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Note" className="sm:col-span-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </FormGrid>
          <div className="mt-4 flex justify-end">
            <Button loading={adjust.isPending} disabled={Number(delta) === 0} onClick={() => adjust.mutate()}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

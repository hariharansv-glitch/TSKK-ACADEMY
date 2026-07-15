'use client';

import { Package } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SimpleListPage, type Column } from '@/components/data/simple-list';
import { formatINR } from '@/lib/utils';

interface ItemRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  size: string | null;
  color: string | null;
  pricePaise: number;
  stockQty: number;
  reorderLevel: number;
  isActive: boolean;
}

const columns: Column<ItemRow>[] = [
  { key: 'sku', header: 'SKU', render: (r) => <span className="font-mono text-xs">{r.sku}</span> },
  { key: 'name', header: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
  { key: 'cat', header: 'Category', render: (r) => r.category },
  { key: 'size', header: 'Size / colour', render: (r) => [r.size, r.color].filter(Boolean).join(' · ') || '—' },
  { key: 'price', header: 'Price', render: (r) => formatINR(r.pricePaise) },
  {
    key: 'stock',
    header: 'Stock',
    render: (r) => (
      <span className={r.stockQty <= r.reorderLevel ? 'font-medium text-destructive' : ''}>
        {r.stockQty}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => <Badge variant={r.isActive ? 'success' : 'muted'}>{r.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>,
  },
];

export default function InventoryPage() {
  return (
    <SimpleListPage<ItemRow>
      title="Inventory"
      description="Uniforms, weapons, protective gear, sale items and store stock."
      endpoint="/inventory/items"
      queryKey={['inventory-items']}
      columns={columns}
      emptyIcon={Package}
      emptyTitle="No items yet"
      actions={
        <Button asChild variant="outline">
          <Link href="/dashboard/inventory/orders">Orders</Link>
        </Button>
      }
      extraParams={{ activeOnly: false }}
    />
  );
}

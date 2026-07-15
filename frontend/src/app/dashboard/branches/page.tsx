'use client';

import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SimpleListPage, type Column } from '@/components/data/simple-list';

interface BranchRow {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  isPrimary: boolean;
  isActive: boolean;
  contactPhone: string | null;
}

const columns: Column<BranchRow>[] = [
  { key: 'name', header: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
  { key: 'code', header: 'Code', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
  { key: 'loc', header: 'Location', render: (r) => `${r.city}, ${r.state}` },
  { key: 'phone', header: 'Phone', render: (r) => r.contactPhone ?? '—' },
  {
    key: 'flags',
    header: '',
    render: (r) => (
      <div className="flex gap-1">
        {r.isPrimary && <Badge variant="info">PRIMARY</Badge>}
        <Badge variant={r.isActive ? 'success' : 'muted'}>{r.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
      </div>
    ),
  },
];

export default function BranchesPage() {
  return (
    <SimpleListPage<BranchRow>
      title="Branches"
      description="Physical locations where classes are conducted."
      endpoint="/branches"
      queryKey={['branches']}
      columns={columns}
      emptyIcon={Building2}
      emptyTitle="No branches yet"
    />
  );
}

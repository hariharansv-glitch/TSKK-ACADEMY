'use client';

import { Users2 } from 'lucide-react';
import { SimpleListPage, type Column } from '@/components/data/simple-list';

interface ParentRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  relationship: string;
  _count?: { children: number };
}

const columns: Column<ParentRow>[] = [
  { key: 'name', header: 'Name', render: (r) => `${r.firstName} ${r.lastName}` },
  { key: 'rel', header: 'Relationship', render: (r) => r.relationship },
  { key: 'phone', header: 'Phone', render: (r) => r.phone },
  { key: 'email', header: 'Email', render: (r) => r.email ?? '—' },
  { key: 'children', header: 'Children', render: (r) => r._count?.children ?? 0 },
];

export default function ParentsPage() {
  return (
    <SimpleListPage<ParentRow>
      title="Parents"
      description="Guardians linked to students in your academy."
      endpoint="/parents"
      queryKey={['parents']}
      columns={columns}
      emptyIcon={Users2}
      emptyTitle="No parents yet"
      emptyDescription="Parents will appear here as you enrol students."
    />
  );
}

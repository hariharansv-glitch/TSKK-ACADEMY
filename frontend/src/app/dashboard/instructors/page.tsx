'use client';

import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SimpleListPage, type Column } from '@/components/data/simple-list';

interface InstructorRow {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  currentBelt: string;
  specialization: string[];
  isActive: boolean;
}

const columns: Column<InstructorRow>[] = [
  { key: 'code', header: 'Code', render: (r) => <span className="font-mono text-xs">{r.employeeCode}</span> },
  { key: 'name', header: 'Name', render: (r) => `${r.firstName} ${r.lastName}` },
  { key: 'belt', header: 'Belt', render: (r) => <Badge variant="muted">{r.currentBelt}</Badge> },
  {
    key: 'specialization',
    header: 'Specialization',
    render: (r) => (r.specialization.length ? r.specialization.join(', ') : '—'),
  },
  { key: 'phone', header: 'Phone', render: (r) => r.phone },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <Badge variant={r.isActive ? 'success' : 'muted'}>{r.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
    ),
  },
];

export default function InstructorsPage() {
  return (
    <SimpleListPage<InstructorRow>
      title="Instructors"
      description="Coaches and evaluators authorised to teach & grade at your academy."
      endpoint="/instructors"
      queryKey={['instructors']}
      columns={columns}
      emptyIcon={Users}
      emptyTitle="No instructors yet"
    />
  );
}

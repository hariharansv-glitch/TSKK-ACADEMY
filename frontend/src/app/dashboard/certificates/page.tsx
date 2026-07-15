'use client';

import Link from 'next/link';
import { FileBadge } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SimpleListPage, type Column } from '@/components/data/simple-list';
import { formatDate } from '@/lib/utils';

interface CertificateRow {
  id: string;
  certificateNumber: string;
  title: string;
  type: string;
  issuedOn: string;
  validUntil: string | null;
  verificationCode: string;
  revokedAt: string | null;
  student: { firstName: string; lastName: string; studentCode: string };
}

const columns: Column<CertificateRow>[] = [
  { key: 'number', header: 'Number', render: (r) => <span className="font-mono text-xs">{r.certificateNumber}</span> },
  { key: 'title', header: 'Title', render: (r) => <span className="font-medium">{r.title}</span> },
  { key: 'type', header: 'Type', render: (r) => r.type },
  {
    key: 'student',
    header: 'Student',
    render: (r) => `${r.student.firstName} ${r.student.lastName}`,
  },
  { key: 'issuedOn', header: 'Issued', render: (r) => formatDate(r.issuedOn) },
  {
    key: 'status',
    header: 'Status',
    render: (r) =>
      r.revokedAt ? <Badge variant="destructive">Revoked</Badge> : <Badge variant="success">Active</Badge>,
  },
  {
    key: 'actions',
    header: '',
    render: (r) => (
      <Button asChild size="sm" variant="ghost">
        <Link href={`/verify/${r.verificationCode}`} target="_blank" rel="noopener">
          Verify
        </Link>
      </Button>
    ),
  },
];

export default function CertificatesPage() {
  return (
    <SimpleListPage<CertificateRow>
      title="Certificates"
      description="Issued certificates with public verification codes."
      endpoint="/certificates"
      queryKey={['certificates']}
      columns={columns}
      emptyIcon={FileBadge}
      emptyTitle="No certificates yet"
      emptyDescription="Certificates auto-issued from belt exams will appear here."
    />
  );
}

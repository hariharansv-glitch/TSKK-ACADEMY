'use client';

import { Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SimpleListPage, type Column } from '@/components/data/simple-list';
import { formatDateTime } from '@/lib/utils';

interface BeltExamRow {
  id: string;
  fromBelt: string;
  toBelt: string;
  examDate: string;
  result: 'PENDING' | 'PASSED' | 'FAILED' | 'RESCHEDULED';
  totalMarks: number | null;
  maxMarks: number | null;
  student: { studentCode: string; firstName: string; lastName: string };
  evaluator?: { firstName: string; lastName: string } | null;
}

const columns: Column<BeltExamRow>[] = [
  { key: 'date', header: 'Exam date', render: (r) => formatDateTime(r.examDate) },
  {
    key: 'student',
    header: 'Student',
    render: (r) => (
      <div>
        <div className="font-medium">
          {r.student.firstName} {r.student.lastName}
        </div>
        <div className="font-mono text-xs text-muted-foreground">{r.student.studentCode}</div>
      </div>
    ),
  },
  {
    key: 'belts',
    header: 'Promotion',
    render: (r) => (
      <div className="text-sm">
        {r.fromBelt} → <strong>{r.toBelt}</strong>
      </div>
    ),
  },
  {
    key: 'evaluator',
    header: 'Evaluator',
    render: (r) => (r.evaluator ? `${r.evaluator.firstName} ${r.evaluator.lastName}` : '—'),
  },
  {
    key: 'marks',
    header: 'Marks',
    render: (r) => (r.totalMarks != null ? `${r.totalMarks}/${r.maxMarks ?? 100}` : '—'),
  },
  {
    key: 'result',
    header: 'Result',
    render: (r) => (
      <Badge
        variant={
          r.result === 'PASSED' ? 'success' : r.result === 'FAILED' ? 'destructive' : 'warning'
        }
      >
        {r.result}
      </Badge>
    ),
  },
];

export default function BeltExamsPage() {
  return (
    <SimpleListPage<BeltExamRow>
      title="Belt exams"
      description="Schedule, grade and track belt promotion examinations."
      endpoint="/belt-exams"
      queryKey={['belt-exams']}
      columns={columns}
      emptyIcon={Award}
      emptyTitle="No belt exams yet"
    />
  );
}

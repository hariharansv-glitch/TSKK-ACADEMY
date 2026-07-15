'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Award, ChevronRight, Clock, ScrollText } from 'lucide-react';

import { apiRequest } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface AssignmentRow {
  id: string;
  title: string;
  description: string;
  dueAt: string;
  maxMarks: number;
  batch: { id: string; name: string };
  instructor?: { firstName: string; lastName: string };
  submissions: Array<{ id: string; marks?: number | null; gradedAt?: string | null; submittedAt: string }>;
}

export default function StudentAssignmentsPage() {
  const list = useQuery({
    queryKey: ['me-assignments'],
    queryFn: () => apiRequest<AssignmentRow[]>({ method: 'GET', url: '/learning/me/assignments' }),
  });

  if (list.isLoading) return <Skeleton className="h-64 w-full" />;

  const items = list.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
        <p className="text-sm text-muted-foreground">Home tasks from your instructors.</p>
      </div>

      {items.length === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          You have no assignments yet.
        </CardContent></Card>
      )}

      <div className="space-y-3">
        {items.map((a) => {
          const submission = a.submissions[0];
          const isOverdue = !submission && new Date(a.dueAt) < new Date();
          const status = submission?.gradedAt
            ? { label: `Graded · ${submission.marks}/${a.maxMarks}`, variant: 'success' as const, icon: Award }
            : submission
              ? { label: 'Submitted · waiting to be graded', variant: 'warning' as const, icon: ScrollText }
              : isOverdue
                ? { label: 'Overdue', variant: 'destructive' as const, icon: Clock }
                : { label: `Due ${formatDate(a.dueAt)}`, variant: 'muted' as const, icon: Clock };
          const Icon = status.icon;
          return (
            <Link key={a.id} href={`/student/assignments/${a.id}`}>
              <Card className="transition-colors hover:border-primary/60">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                  <div>
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {a.batch.name} · {a.instructor ? `Coach ${a.instructor.firstName}` : 'TBA'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <Badge variant={status.variant}><Icon className="h-3 w-3" /> {status.label}</Badge>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

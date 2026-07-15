'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Award, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Field, FormGrid } from '@/components/forms/field';
import { Skeleton } from '@/components/ui/skeleton';

interface Submission {
  id: string;
  studentId: string;
  content?: string;
  attachments: string[];
  submittedAt: string;
  marks?: number | null;
  feedback?: string | null;
  gradedAt?: string | null;
  student: { firstName: string; lastName: string; studentCode: string };
}

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const submissions = useQuery({
    queryKey: ['assignment-submissions', id],
    queryFn: () => apiRequest<Submission[]>({ method: 'GET', url: `/learning/assignments/${id}/submissions` }),
  });

  const [grades, setGrades] = useState<Record<string, { marks: string; feedback: string }>>({});

  const grade = useMutation({
    mutationFn: (submissionId: string) => {
      const g = grades[submissionId];
      return apiRequest({
        method: 'PATCH',
        url: `/learning/submissions/${submissionId}/grade`,
        data: {
          marks: Number(g.marks),
          feedback: g.feedback || undefined,
        },
      });
    },
    onSuccess: (_data, submissionId) => {
      toast.success('Graded');
      setGrades((prev) => ({ ...prev, [submissionId]: { marks: '', feedback: '' } }));
      qc.invalidateQueries({ queryKey: ['assignment-submissions', id] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not grade')),
  });

  if (submissions.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
          <Link href="/dashboard/batches"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Submissions</h1>
      </div>

      {submissions.data?.length === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No submissions yet.</CardContent></Card>
      )}

      <div className="space-y-4">
        {submissions.data?.map((s) => {
          const graded = s.gradedAt != null;
          const g = grades[s.id] ?? { marks: '', feedback: '' };
          return (
            <Card key={s.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">
                    {s.student.firstName} {s.student.lastName}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{s.student.studentCode}</span>
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <Clock className="mr-1 inline h-3 w-3" /> Submitted {formatDate(s.submittedAt)}
                  </p>
                </div>
                {graded ? (
                  <Badge variant="success"><Award className="h-3 w-3" /> {s.marks} marks</Badge>
                ) : (
                  <Badge variant="warning">Awaiting grade</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {s.content && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{s.content}</div>
                )}
                {s.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {s.attachments.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                        Attachment {i + 1}
                      </a>
                    ))}
                  </div>
                )}
                {graded ? (
                  s.feedback && (
                    <div className="rounded-md border bg-primary/5 p-3 text-sm">
                      <p className="text-xs font-semibold text-primary">Instructor feedback</p>
                      <p className="mt-1">{s.feedback}</p>
                    </div>
                  )
                ) : (
                  <FormGrid>
                    <Field label="Marks" required>
                      <Input
                        type="number"
                        value={g.marks}
                        onChange={(e) => setGrades((p) => ({ ...p, [s.id]: { ...g, marks: e.target.value } }))}
                      />
                    </Field>
                    <Field label="Feedback" className="sm:col-span-1">
                      <Textarea
                        rows={2}
                        value={g.feedback}
                        onChange={(e) => setGrades((p) => ({ ...p, [s.id]: { ...g, feedback: e.target.value } }))}
                      />
                    </Field>
                    <div className="sm:col-span-2 flex justify-end">
                      <Button
                        size="sm"
                        disabled={!g.marks}
                        loading={grade.isPending}
                        onClick={() => grade.mutate(s.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" /> Save grade
                      </Button>
                    </div>
                  </FormGrid>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

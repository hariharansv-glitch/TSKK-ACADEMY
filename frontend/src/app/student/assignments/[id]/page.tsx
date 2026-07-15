'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Award, Send } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface AssignmentDetail {
  id: string;
  title: string;
  description: string;
  dueAt: string;
  maxMarks: number;
  studentId: string;
  batch: { id: string; name: string };
  instructor?: { firstName: string; lastName: string };
  submissions: Array<{
    id: string;
    content?: string | null;
    attachments: string[];
    submittedAt: string;
    marks?: number | null;
    feedback?: string | null;
    gradedAt?: string | null;
  }>;
}

export default function StudentAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ['me-assignment', id],
    queryFn: () => apiRequest<AssignmentDetail>({ method: 'GET', url: `/learning/me/assignments/${id}` }),
  });

  const [content, setContent] = useState('');
  useEffect(() => {
    if (detail.data?.submissions[0]?.content) setContent(detail.data.submissions[0].content);
  }, [detail.data]);

  const submit = useMutation({
    mutationFn: () =>
      apiRequest({
        method: 'POST',
        url: `/learning/assignments/${id}/submit`,
        data: {
          studentId: detail.data!.studentId,
          content: content || undefined,
          attachments: [],
        },
      }),
    onSuccess: () => {
      toast.success('Submitted');
      qc.invalidateQueries({ queryKey: ['me-assignment', id] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not submit')),
  });

  if (detail.isLoading || !detail.data) return <Skeleton className="h-64 w-full" />;
  const a = detail.data;
  const sub = a.submissions[0];
  const graded = sub?.gradedAt != null;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
          <Link href="/student/assignments"><ArrowLeft className="h-4 w-4" /> Assignments</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">{a.title}</h1>
        <p className="text-sm text-muted-foreground">
          {a.batch.name} · Due {formatDate(a.dueAt)} · Max {a.maxMarks} marks
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Instructions</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{a.description}</p></CardContent>
      </Card>

      {graded ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-600" /> Graded — {sub!.marks}/{a.maxMarks}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sub!.content && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Your submission</p>
                <p className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">{sub!.content}</p>
              </div>
            )}
            {sub!.feedback && (
              <div>
                <p className="text-xs font-semibold text-primary">Instructor feedback</p>
                <p className="mt-1 whitespace-pre-wrap rounded-md border bg-primary/5 p-3 text-sm">{sub!.feedback}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Your submission</span>
              {sub && <Badge variant="warning">Waiting to be graded</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={8}
              placeholder="Type your answer here, or attach files if allowed by your instructor."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex justify-end">
              <Button loading={submit.isPending} onClick={() => submit.mutate()} disabled={!content.trim()}>
                <Send className="h-4 w-4" /> {sub ? 'Update submission' : 'Submit'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

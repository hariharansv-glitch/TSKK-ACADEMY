'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Award } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FormGrid, FormSection } from '@/components/forms/field';

interface BeltExam {
  id: string;
  examDate: string;
  fromBelt: string;
  toBelt: string;
  result: string;
  maxMarks: number;
  technicalMarks?: number;
  physicalMarks?: number;
  disciplineMarks?: number;
  totalMarks?: number;
  remarks?: string;
  location?: string;
  student: { id: string; firstName: string; lastName: string; studentCode: string; currentBelt: string };
  evaluator?: { id: string; firstName: string; lastName: string } | null;
}

export default function BeltExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['belt-exam', id],
    queryFn: () => apiRequest<BeltExam>({ method: 'GET', url: `/belt-exams/${id}` }),
  });
  const exam = query.data;

  const [result, setResult] = useState<'PASSED' | 'FAILED'>('PASSED');
  const [technical, setTechnical] = useState('80');
  const [physical, setPhysical] = useState('80');
  const [discipline, setDiscipline] = useState('80');
  const [remarks, setRemarks] = useState('');
  const [issueCert, setIssueCert] = useState(true);

  const grade = useMutation({
    mutationFn: () => {
      const t = Number(technical) || 0;
      const p = Number(physical) || 0;
      const d = Number(discipline) || 0;
      return apiRequest({
        method: 'PATCH',
        url: `/belt-exams/${id}/grade`,
        data: {
          technicalMarks: t,
          physicalMarks: p,
          disciplineMarks: d,
          totalMarks: t + p + d,
          result,
          remarks: remarks || undefined,
          issueCertificate: issueCert,
        },
      });
    },
    onSuccess: () => {
      toast.success('Exam graded');
      queryClient.invalidateQueries({ queryKey: ['belt-exam', id] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not grade exam')),
  });

  if (query.isLoading || !exam) return <Skeleton className="h-48 w-full" />;
  const isGraded = exam.result !== 'PENDING';

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
          <Link href="/dashboard/belt-exams">
            <ArrowLeft className="h-4 w-4" /> Belt exams
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Award className="h-6 w-6 text-primary" /> {exam.fromBelt} → {exam.toBelt}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(exam.examDate)} • {exam.location ?? 'Venue TBD'}
            </p>
            <p className="text-sm">
              Student:{' '}
              <Link className="font-medium underline" href={`/dashboard/students/${exam.student.id}`}>
                {exam.student.firstName} {exam.student.lastName}
              </Link>{' '}
              <span className="text-muted-foreground">({exam.student.currentBelt})</span>
            </p>
          </div>
          <Badge
            variant={
              exam.result === 'PASSED'
                ? 'success'
                : exam.result === 'FAILED'
                  ? 'destructive'
                  : 'warning'
            }
          >
            {exam.result}
          </Badge>
        </CardContent>
      </Card>

      {!isGraded && (
        <FormSection title="Grade exam" description="Result is final once submitted. Passing promotes the student's belt.">
          <FormGrid>
            <Field label="Result" required>
              <Select value={result} onValueChange={(v) => setResult(v as 'PASSED' | 'FAILED')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PASSED">Passed</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Technical marks">
              <Input type="number" min={0} max={exam.maxMarks} value={technical} onChange={(e) => setTechnical(e.target.value)} />
            </Field>
            <Field label="Physical marks">
              <Input type="number" min={0} max={exam.maxMarks} value={physical} onChange={(e) => setPhysical(e.target.value)} />
            </Field>
            <Field label="Discipline marks">
              <Input type="number" min={0} max={exam.maxMarks} value={discipline} onChange={(e) => setDiscipline(e.target.value)} />
            </Field>
            <Field label="Remarks" className="sm:col-span-2">
              <Textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>
            <Field label="Auto issue certificate" className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={issueCert}
                  onChange={(e) => setIssueCert(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Automatically issue a certificate if the student passes.
              </label>
            </Field>
          </FormGrid>
          <div className="flex justify-end">
            <Button loading={grade.isPending} onClick={() => grade.mutate()}>
              Submit grade
            </Button>
          </div>
        </FormSection>
      )}

      {isGraded && (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Technical" value={exam.technicalMarks} outOf={exam.maxMarks} />
              <Metric label="Physical" value={exam.physicalMarks} outOf={exam.maxMarks} />
              <Metric label="Discipline" value={exam.disciplineMarks} outOf={exam.maxMarks} />
              <Metric label="Total" value={exam.totalMarks} outOf={exam.maxMarks * 3} />
            </div>
            {exam.remarks && (
              <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-3">{exam.remarks}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value, outOf }: { label: string; value?: number; outOf: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">
        {value ?? '—'}
        <span className="text-sm text-muted-foreground"> / {outOf}</span>
      </div>
    </div>
  );
}

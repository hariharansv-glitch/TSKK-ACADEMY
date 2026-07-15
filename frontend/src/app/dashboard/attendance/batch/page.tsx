'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { apiBlobRequest, apiListRequest, apiRequest, extractErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Field, FormGrid } from '@/components/forms/field';
import { Skeleton } from '@/components/ui/skeleton';

interface BatchOption {
  id: string;
  name: string;
  class: { name: string };
}

interface ReportEntry {
  studentId: string;
  studentName: string;
  studentCode: string;
  status?: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | null;
  attendanceId?: string;
  checkInAt?: string;
}

export default function BatchAttendanceReportPage() {
  const [batchId, setBatchId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const batches = useQuery({
    queryKey: ['batches-all'],
    queryFn: () => apiListRequest<BatchOption>({ method: 'GET', url: '/batches', params: { pageSize: 200, isActive: true } }),
  });

  const report = useQuery({
    queryKey: ['batch-report', batchId, date],
    queryFn: () =>
      apiRequest<{ date: string; entries: ReportEntry[]; stats: Record<string, number> }>({
        method: 'GET',
        url: `/attendance/batches/${batchId}/report`,
        params: { date },
      }),
    enabled: Boolean(batchId && date),
  });

  const mark = useMutation({
    mutationFn: (payload: { studentId: string; status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' }) =>
      apiRequest({
        method: 'POST',
        url: '/attendance/mark',
        data: {
          studentId: payload.studentId,
          batchId,
          date: new Date(date).toISOString(),
          status: payload.status,
        },
      }),
    onSuccess: () => {
      toast.success('Marked');
      report.refetch();
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const exportCsv = async () => {
    try {
      const blob = await apiBlobRequest({
        method: 'GET',
        url: '/attendance/export/csv',
        params: { batchId, from: date, to: date },
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Export failed'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/attendance"><ArrowLeft className="h-4 w-4" /> Attendance</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Daily batch report</h1>
          <p className="text-sm text-muted-foreground">Bulk mark a batch and export as CSV.</p>
        </div>
        <Button variant="outline" disabled={!batchId} onClick={exportCsv}>Export CSV</Button>
      </div>

      <FormGrid>
        <Field label="Batch" required>
          <Select value={batchId} onValueChange={setBatchId}>
            <SelectTrigger><SelectValue placeholder="Choose a batch" /></SelectTrigger>
            <SelectContent>
              {batches.data?.items.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name} · {b.class.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date" required><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </FormGrid>

      {batchId && (
        report.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-4">
            {report.data?.stats && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.data.stats).map(([k, v]) => (
                  <Badge key={k} variant="muted">{k}: {v}</Badge>
                ))}
              </div>
            )}
            <Card>
              <CardContent className="divide-y p-0">
                {report.data?.entries.length === 0 && (
                  <p className="p-6 text-center text-sm text-muted-foreground">No students in this batch.</p>
                )}
                {report.data?.entries.map((e) => (
                  <div key={e.studentId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div>
                      <p className="font-medium">{e.studentName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{e.studentCode}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {e.status && (
                        <Badge
                          variant={
                            e.status === 'PRESENT' ? 'success' :
                            e.status === 'LATE' ? 'warning' :
                            e.status === 'EXCUSED' ? 'muted' : 'destructive'
                          }
                        >{e.status}</Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={mark.isPending}
                        onClick={() => mark.mutate({ studentId: e.studentId, status: 'PRESENT' })}
                      >
                        <CheckCircle2 className="h-4 w-4" /> Present
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={mark.isPending}
                        onClick={() => mark.mutate({ studentId: e.studentId, status: 'ABSENT' })}
                      >
                        <XCircle className="h-4 w-4" /> Absent
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )
      )}
    </div>
  );
}

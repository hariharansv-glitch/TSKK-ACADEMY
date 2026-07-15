'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import { toast } from 'sonner';

import { apiListRequest, apiRequest, extractErrorMessage } from '@/lib/api-client';
import { useDebouncedValue } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FormGrid } from '@/components/forms/field';

const BELTS = ['WHITE', 'YELLOW', 'ORANGE', 'GREEN', 'BLUE', 'PURPLE', 'BROWN', 'RED', 'BLACK'] as const;

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
  currentBelt: string;
}

export default function ScheduleBeltExamPage() {
  const router = useRouter();
  const [studentSearch, setStudentSearch] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [fromBelt, setFromBelt] = useState<string>('WHITE');
  const [toBelt, setToBelt] = useState<string>('YELLOW');
  const [examDate, setExamDate] = useState(new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10));
  const [location, setLocation] = useState('');
  const [maxMarks, setMaxMarks] = useState<number>(100);
  const [remarks, setRemarks] = useState('');

  const debounced = useDebouncedValue(studentSearch, 300);
  const students = useQuery({
    queryKey: ['students-belt-search', debounced],
    queryFn: () =>
      apiListRequest<StudentRow>({
        method: 'GET',
        url: '/students',
        params: { search: debounced || undefined, pageSize: 8 },
      }),
    enabled: debounced.length > 0,
  });
  const selected = students.data?.items.find((s) => s.id === studentId);

  const schedule = useMutation({
    mutationFn: () =>
      apiRequest<{ id: string }>({
        method: 'POST',
        url: '/belt-exams',
        data: {
          studentId,
          fromBelt: selected?.currentBelt ?? fromBelt,
          toBelt,
          examDate,
          location: location || undefined,
          maxMarks,
          remarks: remarks || undefined,
        },
      }),
    onSuccess: (exam) => {
      toast.success('Belt exam scheduled');
      router.push(`/dashboard/belt-exams/${exam.id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not schedule exam')),
  });

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
          <Link href="/dashboard/belt-exams">
            <ArrowLeft className="h-4 w-4" /> Belt exams
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Schedule a belt exam</h1>
        <p className="text-sm text-muted-foreground">Assess the student's progression to the next belt.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Candidate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search students…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              {students.data?.items.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setStudentId(s.id);
                    setFromBelt(s.currentBelt);
                  }}
                  className={
                    'flex w-full items-center justify-between border-b p-3 text-left text-sm last:border-0 hover:bg-accent ' +
                    (studentId === s.id ? 'bg-accent' : '')
                  }
                >
                  <div>
                    <div className="font-medium">
                      {s.firstName} {s.lastName}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {s.studentCode} • {s.currentBelt}
                    </div>
                  </div>
                </button>
              ))}
              {!students.data && (
                <p className="p-6 text-center text-sm text-muted-foreground">Search to add a candidate.</p>
              )}
            </div>
            {selected && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                Current belt: <span className="font-semibold">{selected.currentBelt}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exam details</CardTitle>
          </CardHeader>
          <CardContent>
            <FormGrid>
              <Field label="From belt" required>
                <Select value={fromBelt} onValueChange={setFromBelt}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BELTS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="To belt" required>
                <Select value={toBelt} onValueChange={setToBelt}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BELTS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Exam date" required>
                <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
              </Field>
              <Field label="Max marks" required>
                <Input type="number" min={1} value={maxMarks} onChange={(e) => setMaxMarks(Number(e.target.value))} />
              </Field>
              <Field label="Location" className="sm:col-span-2">
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Main hall" />
              </Field>
              <Field label="Remarks" className="sm:col-span-2">
                <Textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </Field>
            </FormGrid>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button disabled={!studentId} loading={schedule.isPending} onClick={() => schedule.mutate()}>
          Schedule exam
        </Button>
      </div>
    </div>
  );
}

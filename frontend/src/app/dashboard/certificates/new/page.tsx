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
import { Field, FormGrid, FormSection } from '@/components/forms/field';

const CERT_TYPES = ['BELT_PROMOTION', 'COURSE_COMPLETION', 'PARTICIPATION', 'ACHIEVEMENT', 'ATTENDANCE', 'EVENT'];

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
}

export default function IssueCertificatePage() {
  const router = useRouter();
  const [studentSearch, setStudentSearch] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [type, setType] = useState('COURSE_COMPLETION');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const debounced = useDebouncedValue(studentSearch, 300);
  const students = useQuery({
    queryKey: ['students-cert-search', debounced],
    queryFn: () =>
      apiListRequest<StudentRow>({
        method: 'GET',
        url: '/students',
        params: { search: debounced || undefined, pageSize: 8 },
      }),
    enabled: debounced.length > 0,
  });

  const issue = useMutation({
    mutationFn: () =>
      apiRequest<{ id: string }>({
        method: 'POST',
        url: '/certificates',
        data: {
          studentId,
          type,
          title,
          description: description || undefined,
          validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
        },
      }),
    onSuccess: (cert) => {
      toast.success('Certificate issued');
      router.push(`/dashboard/certificates/${cert.id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not issue certificate')),
  });

  const selected = students.data?.items.find((s) => s.id === studentId);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
          <Link href="/dashboard/certificates">
            <ArrowLeft className="h-4 w-4" /> Certificates
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Issue certificate</h1>
        <p className="text-sm text-muted-foreground">
          Digitally signed PDF certificates with a public verification QR code.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recipient</CardTitle>
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
          <div className="max-h-64 overflow-y-auto rounded-md border">
            {students.data?.items.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStudentId(s.id)}
                className={
                  'flex w-full items-center justify-between border-b p-3 text-left text-sm last:border-0 hover:bg-accent ' +
                  (studentId === s.id ? 'bg-accent' : '')
                }
              >
                <span className="font-medium">
                  {s.firstName} {s.lastName}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{s.studentCode}</span>
              </button>
            ))}
            {!students.data && (
              <p className="p-6 text-center text-sm text-muted-foreground">Type to search students.</p>
            )}
          </div>
          {selected && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              Recipient:{' '}
              <span className="font-medium">
                {selected.firstName} {selected.lastName}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <FormSection title="Certificate details">
        <FormGrid>
          <Field label="Type" required>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CERT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replaceAll('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Silambam Level 2" />
          </Field>
          <Field label="Valid until (optional)">
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </FormGrid>
      </FormSection>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button disabled={!studentId || !title} loading={issue.isPending} onClick={() => issue.mutate()}>
          Generate & issue
        </Button>
      </div>
    </div>
  );
}

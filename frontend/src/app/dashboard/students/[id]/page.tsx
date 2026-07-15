'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Award, Calendar, IdCard, Pencil, Receipt, ShieldCheck, User } from 'lucide-react';

import { apiRequest, apiListRequest, apiUrl } from '@/lib/api-client';
import { formatDate, formatDateTime, formatINR, initials } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type Tab = 'profile' | 'attendance' | 'fees' | 'belts' | 'certificates';

interface Student {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  admissionDate: string;
  bloodGroup?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  photoUrl?: string | null;
  qrCode?: string | null;
  currentBelt: string;
  status: string;
  medicalConditions?: string | null;
  allergies?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  branch?: { id: string; name: string } | null;
  parents?: Array<{ id: string; firstName: string; lastName: string; relation: string; phone?: string }>;
}

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'attendance', label: 'Attendance', icon: Calendar },
  { key: 'fees', label: 'Fees', icon: Receipt },
  { key: 'belts', label: 'Belt exams', icon: Award },
  { key: 'certificates', label: 'Certificates', icon: ShieldCheck },
];

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('profile');

  const studentQuery = useQuery({
    queryKey: ['student', id],
    queryFn: () => apiRequest<Student>({ method: 'GET', url: `/students/${id}` }),
    enabled: !!id,
  });

  const student = studentQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild size="sm" variant="ghost" className="-ml-2 h-7">
          <Link href="/dashboard/students">
            <ArrowLeft className="h-4 w-4" /> Back to students
          </Link>
        </Button>
        {student && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/students/${student.id}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </Button>
        )}
      </div>

      {studentQuery.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : student ? (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-6 p-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={student.photoUrl ?? undefined} alt={student.firstName} />
                <AvatarFallback>{initials(`${student.firstName} ${student.lastName}`)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">
                    {student.firstName} {student.lastName}
                  </h1>
                  <Badge variant="muted" className="font-mono text-xs">
                    {student.studentCode}
                  </Badge>
                  <Badge
                    variant={
                      student.status === 'ACTIVE'
                        ? 'success'
                        : student.status === 'LEFT'
                          ? 'destructive'
                          : 'warning'
                    }
                  >
                    {student.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Belt: <span className="font-medium text-foreground">{student.currentBelt}</span>
                  {student.branch && (
                    <>
                      {' '}• Branch: <span className="font-medium text-foreground">{student.branch.name}</span>
                    </>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  Admitted on {formatDate(student.admissionDate)} • DOB {formatDate(student.dateOfBirth)}
                </p>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-md border p-2">
                <Image
                  src={apiUrl(`/students/${student.id}/qr.png`)}
                  alt="Student QR"
                  width={100}
                  height={100}
                  unoptimized
                />
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <IdCard className="h-3 w-3" /> QR ID
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={
                    'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
                    (tab === t.key ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')
                  }
                >
                  <Icon className="h-4 w-4" /> {t.label}
                </button>
              );
            })}
          </div>

          {tab === 'profile' && <ProfileTab student={student} />}
          {tab === 'attendance' && <AttendanceTab studentId={student.id} />}
          {tab === 'fees' && <FeesTab studentId={student.id} />}
          {tab === 'belts' && <BeltsTab studentId={student.id} />}
          {tab === 'certificates' && <CertificatesTab studentId={student.id} />}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Student not found.</p>
      )}
    </div>
  );
}

function ProfileTab({ student }: { student: Student }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardDescription>Reach the student directly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Email" value={student.email} />
          <Row label="Phone" value={student.phone} />
          <Row label="Address" value={[student.addressLine1, student.city, student.state, student.postalCode].filter(Boolean).join(', ') || undefined} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Emergency & Medical</CardTitle>
          <CardDescription>In case of unforeseen events.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Emergency contact" value={student.emergencyContactName} />
          <Row label="Emergency phone" value={student.emergencyContactPhone} />
          <Row label="Blood group" value={student.bloodGroup} />
          <Row label="Medical conditions" value={student.medicalConditions} />
          <Row label="Allergies" value={student.allergies} />
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Parents / Guardians</CardTitle>
        </CardHeader>
        <CardContent>
          {student.parents && student.parents.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {student.parents.map((p) => (
                <li key={p.id} className="rounded-md border p-3">
                  <div className="font-medium">
                    {p.firstName} {p.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.relation}
                    {p.phone && <> • {p.phone}</>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No parents linked yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || '—'}</span>
    </div>
  );
}

function AttendanceTab({ studentId }: { studentId: string }) {
  const query = useQuery({
    queryKey: ['student-attendance', studentId],
    queryFn: () =>
      apiListRequest<{
        id: string;
        markedAt: string;
        status: string;
        note?: string;
      }>({
        method: 'GET',
        url: '/attendance',
        params: { studentId, pageSize: 30 },
      }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent attendance</CardTitle>
      </CardHeader>
      <CardContent className="divide-y text-sm">
        {query.isLoading && <Skeleton className="h-24 w-full" />}
        {query.data?.items.length === 0 && <p className="py-6 text-muted-foreground">No attendance records yet.</p>}
        {query.data?.items.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-2">
            <span>{formatDateTime(a.markedAt)}</span>
            <Badge
              variant={
                a.status === 'PRESENT'
                  ? 'success'
                  : a.status === 'ABSENT'
                    ? 'destructive'
                    : 'warning'
              }
            >
              {a.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FeesTab({ studentId }: { studentId: string }) {
  const query = useQuery({
    queryKey: ['student-fees', studentId],
    queryFn: () =>
      apiListRequest<{
        id: string;
        invoiceNumber: string;
        status: string;
        totalPaise: number;
        balancePaise: number;
        dueDate: string;
      }>({
        method: 'GET',
        url: '/fees/invoices',
        params: { studentId, pageSize: 30 },
      }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
      </CardHeader>
      <CardContent className="divide-y text-sm">
        {query.isLoading && <Skeleton className="h-24 w-full" />}
        {query.data?.items.length === 0 && <p className="py-6 text-muted-foreground">No invoices yet.</p>}
        {query.data?.items.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between py-2">
            <div>
              <div className="font-mono text-xs">{inv.invoiceNumber}</div>
              <div className="text-xs text-muted-foreground">Due {formatDate(inv.dueDate)}</div>
            </div>
            <div className="text-right">
              <div className="font-medium">{formatINR(inv.totalPaise / 100)}</div>
              <Badge
                variant={
                  inv.status === 'PAID'
                    ? 'success'
                    : inv.status === 'OVERDUE'
                      ? 'destructive'
                      : 'warning'
                }
                className="mt-1"
              >
                {inv.status}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BeltsTab({ studentId }: { studentId: string }) {
  const query = useQuery({
    queryKey: ['student-belts', studentId],
    queryFn: () =>
      apiListRequest<{
        id: string;
        examDate: string;
        beltAttempted: string;
        result?: string;
        score?: number;
      }>({
        method: 'GET',
        url: '/belt-exams',
        params: { studentId, pageSize: 30 },
      }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Belt exams</CardTitle>
      </CardHeader>
      <CardContent className="divide-y text-sm">
        {query.isLoading && <Skeleton className="h-24 w-full" />}
        {query.data?.items.length === 0 && <p className="py-6 text-muted-foreground">No belt exams yet.</p>}
        {query.data?.items.map((b) => (
          <div key={b.id} className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">{b.beltAttempted}</div>
              <div className="text-xs text-muted-foreground">{formatDate(b.examDate)}</div>
            </div>
            <Badge variant={b.result === 'PASSED' ? 'success' : b.result === 'FAILED' ? 'destructive' : 'muted'}>
              {b.result ?? 'SCHEDULED'}
              {typeof b.score === 'number' && ` • ${b.score}`}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CertificatesTab({ studentId }: { studentId: string }) {
  const query = useQuery({
    queryKey: ['student-certs', studentId],
    queryFn: () =>
      apiListRequest<{
        id: string;
        certificateNumber: string;
        title: string;
        issuedAt: string;
        status: string;
        pdfUrl?: string;
        verificationCode: string;
      }>({
        method: 'GET',
        url: '/certificates',
        params: { studentId, pageSize: 30 },
      }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Certificates</CardTitle>
      </CardHeader>
      <CardContent className="divide-y text-sm">
        {query.isLoading && <Skeleton className="h-24 w-full" />}
        {query.data?.items.length === 0 && <p className="py-6 text-muted-foreground">No certificates issued yet.</p>}
        {query.data?.items.map((c) => (
          <div key={c.id} className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">{c.title}</div>
              <div className="text-xs text-muted-foreground">
                {c.certificateNumber} • Issued {formatDate(c.issuedAt)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={c.status === 'ISSUED' ? 'success' : 'destructive'}>{c.status}</Badge>
              {c.pdfUrl && (
                <Button asChild size="sm" variant="outline">
                  <a href={c.pdfUrl} target="_blank" rel="noreferrer">
                    View
                  </a>
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

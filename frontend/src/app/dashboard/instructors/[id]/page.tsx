'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import { apiRequest } from '@/lib/api-client';
import { formatDate, formatINR, initials } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Instructor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employeeCode?: string;
  specialization?: string;
  belt?: string;
  joiningDate: string;
  status: string;
  photoUrl?: string;
  bio?: string;
  salaryPaise?: number;
  batches?: Array<{ id: string; name: string; scheduleSummary?: string }>;
}

export default function InstructorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useQuery({
    queryKey: ['instructor', id],
    queryFn: () => apiRequest<Instructor>({ method: 'GET', url: `/instructors/${id}` }),
  });
  if (query.isLoading || !query.data) return <Skeleton className="h-48 w-full" />;
  const i = query.data;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
          <Link href="/dashboard/instructors">
            <ArrowLeft className="h-4 w-4" /> Instructors
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 p-6">
          <Avatar className="h-20 w-20">
            <AvatarImage src={i.photoUrl} alt={i.firstName} />
            <AvatarFallback>{initials(`${i.firstName} ${i.lastName}`)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">
                {i.firstName} {i.lastName}
              </h1>
              <Badge variant={i.status === 'ACTIVE' ? 'success' : 'muted'}>{i.status}</Badge>
              {i.belt && <Badge variant="muted">{i.belt}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {i.specialization ?? 'Instructor'} • {i.email} • {i.phone}
            </p>
            <p className="text-sm text-muted-foreground">Joined {formatDate(i.joiningDate)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bio</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {i.bio ?? <span className="text-muted-foreground">No bio provided.</span>}
          </CardContent>
        </Card>
        {i.salaryPaise !== undefined && (
          <Card>
            <CardHeader>
              <CardTitle>Compensation</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              Monthly salary:{' '}
              <span className="font-semibold">{formatINR(i.salaryPaise / 100)}</span>
            </CardContent>
          </Card>
        )}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Batches</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {i.batches && i.batches.length > 0 ? (
              <ul className="divide-y">
                {i.batches.map((b) => (
                  <li key={b.id} className="flex items-center justify-between py-2">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-xs text-muted-foreground">{b.scheduleSummary ?? '—'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-muted-foreground">No batches assigned.</span>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CheckCircle2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';

interface Academy {
  id: string;
  name: string;
  slug: string;
  discipline: string;
  status: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  createdAt: string;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  subscription?: {
    plan: string;
    status: string;
    seatLimit: number;
    trialEndsAt?: string;
    currentPeriodEnd?: string;
  };
  _count?: { students: number; instructors: number; branches: number };
}

export default function AcademyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const academy = useQuery({
    queryKey: ['academy', id],
    queryFn: () => apiRequest<Academy>({ method: 'GET', url: `/academies/${id}` }),
  });

  const suspend = useMutation({
    mutationFn: () => {
      const reason = window.prompt('Reason for suspension?') ?? '';
      if (!reason) throw new Error('Reason required');
      return apiRequest({ method: 'POST', url: `/academies/${id}/suspend`, data: { reason } });
    },
    onSuccess: () => {
      toast.success('Academy suspended');
      qc.invalidateQueries({ queryKey: ['academy', id] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const reactivate = useMutation({
    mutationFn: () => apiRequest({ method: 'POST', url: `/academies/${id}/reactivate` }),
    onSuccess: () => {
      toast.success('Academy reactivated');
      qc.invalidateQueries({ queryKey: ['academy', id] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => apiRequest({ method: 'DELETE', url: `/academies/${id}` }),
    onSuccess: () => {
      toast.success('Academy deleted');
      window.location.href = '/platform/academies';
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not delete academy')),
  });

  if (academy.isLoading || !academy.data) return <Skeleton className="h-64 w-full" />;
  const a = academy.data;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
          <Link href="/platform/academies"><ArrowLeft className="h-4 w-4" /> Academies</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{a.name}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{a.slug}</span> · Created {formatDate(a.createdAt)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={a.status === 'ACTIVE' ? 'success' : a.status === 'SUSPENDED' ? 'destructive' : 'muted'}>{a.status}</Badge>
            <Badge variant="muted">{a.discipline}</Badge>
            {a.subscription && <Badge variant="outline">{a.subscription.plan}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {a.status === 'ACTIVE' ? (
            <Button variant="outline" onClick={() => suspend.mutate()} loading={suspend.isPending}>
              <Ban className="h-4 w-4" /> Suspend
            </Button>
          ) : a.status === 'SUSPENDED' ? (
            <Button variant="outline" onClick={() => reactivate.mutate()} loading={reactivate.isPending}>
              <CheckCircle2 className="h-4 w-4" /> Reactivate
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm(`Permanently delete ${a.name} and ALL its data?`)) remove.mutate();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Email" value={a.contactEmail} />
            <Row label="Phone" value={a.contactPhone} />
            {a.websiteUrl && <Row label="Website" value={a.websiteUrl} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Address</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{a.addressLine1}</p>
            {a.addressLine2 && <p>{a.addressLine2}</p>}
            <p>{a.city}, {a.state} {a.postalCode}</p>
            <p>{a.country}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {a.subscription ? (
              <>
                <Row label="Plan" value={a.subscription.plan} />
                <Row label="Status" value={a.subscription.status} />
                <Row label="Seats" value={String(a.subscription.seatLimit)} />
                {a.subscription.trialEndsAt && <Row label="Trial ends" value={formatDate(a.subscription.trialEndsAt)} />}
                {a.subscription.currentPeriodEnd && <Row label="Renews" value={formatDate(a.subscription.currentPeriodEnd)} />}
              </>
            ) : <p className="text-muted-foreground">No subscription configured.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Usage</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Students" value={String(a._count?.students ?? 0)} />
            <Row label="Instructors" value={String(a._count?.instructors ?? 0)} />
            <Row label="Branches" value={String(a._count?.branches ?? 0)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

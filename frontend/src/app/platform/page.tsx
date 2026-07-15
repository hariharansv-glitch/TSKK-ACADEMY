'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Building2, GraduationCap, Users, IndianRupee } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface PlatformStats {
  academies: { total: number; active: number };
  students: { total: number };
  instructors: { total: number };
  revenue: { totalPaise: number; totalFormatted: string };
  subscriptions: Array<{ plan: string; status: string; _count: { _all: number } }>;
}

export default function PlatformOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-overview'],
    queryFn: () => apiRequest<PlatformStats>({ method: 'GET', url: '/reports/platform' }),
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform overview</h1>
          <p className="text-sm text-muted-foreground">
            Aggregate metrics across all academies on the platform.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/platform/academies">Manage academies</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Building2}
          label="Total academies"
          value={data ? `${data.academies.active} / ${data.academies.total}` : undefined}
          hint="Active / total"
          loading={isLoading}
        />
        <Stat
          icon={GraduationCap}
          label="Students"
          value={data?.students.total}
          loading={isLoading}
        />
        <Stat
          icon={Users}
          label="Instructors"
          value={data?.instructors.total}
          loading={isLoading}
        />
        <Stat
          icon={IndianRupee}
          label="Total collected"
          value={data?.revenue.totalFormatted}
          loading={isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data?.subscriptions.map((s, i) => (
                <div key={i} className="rounded-lg border px-4 py-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {s.plan} · {s.status}
                  </div>
                  <div className="mt-1 text-2xl font-bold">{s._count._all}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: number | string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-3xl font-bold tracking-tight">{value ?? '—'}</div>
        )}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { Award, ClipboardList, CreditCard, GraduationCap } from 'lucide-react';

import { apiRequest } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatINR } from '@/lib/utils';

interface ChildSummary {
  student: {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string;
    currentBelt: string;
  };
  attendanceThisMonth: {
    workingDays: number;
    present: number;
    percent: number;
  };
  pendingBalancePaise: number;
  certificatesCount: number;
}

export default function ParentDashboard() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['parent', 'children'],
    queryFn: () => apiRequest<ChildSummary[]>({ method: 'GET', url: '/parents/me/children' }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hello, {user?.firstName} 👋</h1>
        <p className="text-sm text-muted-foreground">
          Here's an overview of your children's progress at the academy.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No children linked to your account yet. Please contact your academy administrator.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data?.map((child) => (
            <Card key={child.student.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">
                    {child.student.firstName} {child.student.lastName}
                  </CardTitle>
                  <Badge variant="muted">{child.student.currentBelt}</Badge>
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  {child.student.studentCode}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Stat
                  icon={ClipboardList}
                  label="Attendance this month"
                  value={`${child.attendanceThisMonth.percent}%`}
                  hint={`${child.attendanceThisMonth.present} of ${child.attendanceThisMonth.workingDays} working days`}
                />
                <Stat
                  icon={CreditCard}
                  label="Pending balance"
                  value={formatINR(child.pendingBalancePaise)}
                  hint={child.pendingBalancePaise > 0 ? 'Please clear pending dues' : 'All clear'}
                  tone={child.pendingBalancePaise > 0 ? 'warning' : 'success'}
                />
                <Stat
                  icon={Award}
                  label="Certificates"
                  value={String(child.certificatesCount)}
                  hint="Awarded so far"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: 'warning' | 'success';
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-primary" />
        <div>
          <div className="text-sm font-medium">{label}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      </div>
      <div
        className={`text-lg font-bold ${
          tone === 'warning' ? 'text-amber-600' : tone === 'success' ? 'text-emerald-600' : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}

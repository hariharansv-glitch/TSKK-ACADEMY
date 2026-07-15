'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Award,
  ClipboardList,
  CreditCard,
  GraduationCap,
  ReceiptIndianRupee,
  TrendingUp,
} from 'lucide-react';

import { apiRequest } from '@/lib/api-client';
import { formatINR } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth-store';

interface DashboardStats {
  students: { total: number; active: number };
  instructors: { active: number };
  attendance: { today: number };
  finance: {
    monthRevenuePaise: number;
    monthRevenueFormatted: string;
    monthPaymentCount: number;
    pendingInvoicesCount: number;
    pendingBalancePaise: number;
    pendingBalanceFormatted: string;
    overdueInvoicesCount: number;
  };
  belts: { upcomingExams: number; recentPromotions: number };
}

function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<DashboardStats>({ method: 'GET', url: '/reports/dashboard' }),
  });
}

export default function DashboardHome() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useDashboard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.firstName} 👋</h1>
        <p className="text-sm text-muted-foreground">Here's the pulse of your academy at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={GraduationCap}
          label="Active students"
          value={data?.students.active}
          hint={data ? `${data.students.total} total on roster` : undefined}
          loading={isLoading}
        />
        <Stat
          icon={ClipboardList}
          label="Attendance today"
          value={data?.attendance.today}
          hint="Present + late check-ins"
          loading={isLoading}
        />
        <Stat
          icon={ReceiptIndianRupee}
          label="Revenue (this month)"
          value={data?.finance.monthRevenueFormatted}
          hint={data ? `${data.finance.monthPaymentCount} payments captured` : undefined}
          loading={isLoading}
        />
        <Stat
          icon={CreditCard}
          label="Pending balance"
          value={data?.finance.pendingBalanceFormatted}
          hint={
            data
              ? `${data.finance.pendingInvoicesCount} open · ${data.finance.overdueInvoicesCount} overdue`
              : undefined
          }
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          icon={TrendingUp}
          label="Active instructors"
          value={data?.instructors.active}
          loading={isLoading}
        />
        <Stat
          icon={Award}
          label="Upcoming belt exams"
          value={data?.belts.upcomingExams}
          hint="Next 30 days"
          loading={isLoading}
        />
        <Stat
          icon={Award}
          label="Promotions this month"
          value={data?.belts.recentPromotions}
          loading={isLoading}
        />
      </div>
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

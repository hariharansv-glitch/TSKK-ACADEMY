'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Users, Award } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Legend } from 'recharts';

import { apiRequest } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINR } from '@/lib/utils';

interface RevenuePoint {
  month: string;
  totalPaise: number;
  totalFormatted: string;
  paymentCount: number;
}
interface RevenueData {
  from: string;
  to: string;
  series: RevenuePoint[];
}
interface BeltProgression {
  distribution: Array<{ belt: string; count: number }>;
  passRates: Array<{ belt: string; passed: number; failed: number; passRatePercent: number }>;
}

const BELT_COLORS: Record<string, string> = {
  WHITE: '#e5e7eb',
  YELLOW: '#f59e0b',
  ORANGE: '#fb923c',
  GREEN: '#22c55e',
  BLUE: '#3b82f6',
  PURPLE: '#a855f7',
  BROWN: '#a16207',
  RED: '#dc2626',
  BLACK: '#111827',
};

export default function ReportsPage() {
  const revenue = useQuery({
    queryKey: ['reports', 'revenue'],
    queryFn: () => apiRequest<RevenueData>({ method: 'GET', url: '/reports/revenue' }),
  });
  const progression = useQuery({
    queryKey: ['reports', 'belt-progression'],
    queryFn: () => apiRequest<BeltProgression>({ method: 'GET', url: '/reports/belt-progression' }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Revenue, attendance, dropouts and belt progression at a glance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Monthly revenue
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {revenue.isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue.data?.series ?? []}>
                <XAxis
                  dataKey="month"
                  tickFormatter={(v: string) =>
                    new Date(v).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
                  }
                  fontSize={12}
                />
                <YAxis tickFormatter={(v: number) => `₹${Math.round(v / 100000)}L`} fontSize={12} />
                <Tooltip
                  formatter={(value: number) => formatINR(value)}
                  labelFormatter={(v: string) =>
                    new Date(v).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                  }
                />
                <Bar dataKey="totalPaise" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Belt distribution (active students)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {progression.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={progression.data?.distribution ?? []}
                    dataKey="count"
                    nameKey="belt"
                    outerRadius={90}
                    label={(entry) => entry.belt}
                  >
                    {(progression.data?.distribution ?? []).map((entry) => (
                      <Cell key={entry.belt} fill={BELT_COLORS[entry.belt] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" /> Belt exam pass rates
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {progression.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progression.data?.passRates ?? []}>
                  <XAxis dataKey="belt" fontSize={12} />
                  <YAxis unit="%" fontSize={12} />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Bar dataKey="passRatePercent" fill="hsl(var(--secondary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

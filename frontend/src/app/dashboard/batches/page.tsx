'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';

import { apiListRequest } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface BatchRow {
  id: string;
  name: string;
  isActive: boolean;
  capacity: number;
  startDate: string;
  endDate?: string;
  class: { id: string; name: string };
  instructor?: { firstName: string; lastName: string };
  branch?: { name: string };
  _count: { students: number };
}

export default function BatchesPage() {
  const [search, setSearch] = useState('');
  const list = useQuery({
    queryKey: ['batches', search],
    queryFn: () => apiListRequest<BatchRow>({ method: 'GET', url: '/batches', params: { search: search || undefined, pageSize: 50 } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batches</h1>
          <p className="text-sm text-muted-foreground">Groups of students training together on a shared schedule.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/batches/classes">Manage classes</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/batches/new"><Plus className="h-4 w-4" /> New batch</Link>
          </Button>
        </div>
      </div>

      <Input placeholder="Search batch or class..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />

      {list.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.data?.items.map((b) => (
            <Card key={b.id} className="hover:border-primary transition-colors">
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">
                    <Link href={`/dashboard/batches/${b.id}`} className="hover:underline">{b.name}</Link>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{b.class.name}</p>
                </div>
                <Badge variant={b.isActive ? 'success' : 'muted'}>{b.isActive ? 'Active' : 'Paused'}</Badge>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  Instructor: {b.instructor ? `${b.instructor.firstName} ${b.instructor.lastName}` : '—'}
                </p>
                <p className="text-muted-foreground">Branch: {b.branch?.name ?? '—'}</p>
                <p className="text-muted-foreground">Starts {new Date(b.startDate).toLocaleDateString('en-IN')}</p>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{b._count.students}</span>
                  <span className="text-muted-foreground">/ {b.capacity} enrolled</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {list.data?.items.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No batches yet. <Link href="/dashboard/batches/new" className="underline">Create one</Link> to get started.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

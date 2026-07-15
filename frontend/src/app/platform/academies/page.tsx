'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Plus, Search } from 'lucide-react';

import { apiListRequest } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface AcademyRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  discipline: string;
  city?: string;
  state?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export default function PlatformAcademiesPage() {
  const [search, setSearch] = useState('');
  const list = useQuery({
    queryKey: ['platform-academies', search],
    queryFn: () =>
      apiListRequest<AcademyRow>({
        method: 'GET',
        url: '/academies',
        params: { search: search || undefined, pageSize: 50 },
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/platform"><ArrowLeft className="h-4 w-4" /> Platform</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Academies</h1>
          <p className="text-sm text-muted-foreground">Manage every tenant on the platform.</p>
        </div>
        <Button asChild>
          <Link href="/platform/academies/new"><Plus className="h-4 w-4" /> New academy</Link>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="pl-8"
        />
      </div>

      {list.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.data?.items.map((a) => (
            <Link key={a.id} href={`/platform/academies/${a.id}`}>
              <Card className="transition-colors hover:border-primary/60">
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                  <div>
                    <CardTitle className="text-base">{a.name}</CardTitle>
                    <p className="font-mono text-xs text-muted-foreground">{a.slug}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={a.status === 'ACTIVE' ? 'success' : a.status === 'SUSPENDED' ? 'destructive' : 'muted'}>{a.status}</Badge>
                    <Badge variant="muted">{a.discipline}</Badge>
                  </div>
                  <p className="text-muted-foreground">{a.city ?? '—'}{a.state ? `, ${a.state}` : ''}</p>
                  {a.contactEmail && <p className="text-muted-foreground">{a.contactEmail}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
          {list.data?.items.length === 0 && (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No academies yet.</CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}

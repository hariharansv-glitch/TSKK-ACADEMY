'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LogOut, Monitor, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Session {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  device?: string;
  location?: string;
  lastActiveAt?: string;
  createdAt: string;
  expiresAt: string;
}

function pickIcon(ua?: string) {
  if (!ua) return Monitor;
  return /mobile|iphone|android/i.test(ua) ? Smartphone : Monitor;
}

export default function SessionsPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['my-sessions'],
    queryFn: () => apiRequest<Session[]>({ method: 'GET', url: '/users/me/sessions' }),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => apiRequest({ method: 'DELETE', url: `/users/me/sessions/${id}` }),
    onSuccess: () => {
      toast.success('Session revoked');
      qc.invalidateQueries({ queryKey: ['my-sessions'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not revoke session')),
  });

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
          <Link href="/dashboard/settings"><ArrowLeft className="h-4 w-4" /> Settings</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Active sessions</h1>
        <p className="text-sm text-muted-foreground">
          Sign yourself out of any device that has access to your account.
        </p>
      </div>

      {list.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {list.data?.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">No active sessions.</p>
            )}
            {list.data?.map((s) => {
              const Icon = pickIcon(s.userAgent);
              return (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{s.device ?? 'Unknown device'}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.location ?? s.ipAddress ?? '—'} · Last active{' '}
                        {s.lastActiveAt ? formatDistanceToNow(new Date(s.lastActiveAt), { addSuffix: true }) : 'unknown'}
                      </p>
                      {s.userAgent && (
                        <p className="line-clamp-1 max-w-md text-[11px] text-muted-foreground">{s.userAgent}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="muted">Expires {new Date(s.expiresAt).toLocaleDateString('en-IN')}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => revoke.mutate(s.id)}>
                      <LogOut className="h-4 w-4" /> Revoke
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Check, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

import { apiListRequest, apiRequest, extractErrorMessage } from '@/lib/api-client';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/data/empty-state';
import { PaginationBar } from '@/components/data/pagination-bar';

interface Notif {
  id: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  readAt?: string | null;
  createdAt: string;
  priority?: string;
}

export default function NotificationsInboxPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const query = useQuery({
    queryKey: ['notifications', page],
    queryFn: () =>
      apiListRequest<Notif>({
        method: 'GET',
        url: '/notifications/inbox',
        params: { page, pageSize },
      }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest({ method: 'POST', url: `/notifications/${id}/read` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (err) => toast.error(extractErrorMessage(err, 'Failed')),
  });

  const markAllRead = useMutation({
    mutationFn: () => apiRequest({ method: 'POST', url: '/notifications/read-all' }),
    onSuccess: () => {
      toast.success('All caught up');
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">All messages sent to you across channels.</p>
        </div>
        <Button variant="outline" onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
          <CheckCheck className="h-4 w-4" /> Mark all read
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : query.data?.items.length === 0 ? (
            <EmptyState icon={BellRing} title="No notifications yet" description="You’re all caught up." />
          ) : (
            <>
              <ul className="divide-y">
                {query.data?.items.map((n) => (
                  <li
                    key={n.id}
                    className={
                      'flex items-start justify-between gap-4 p-4 transition-colors ' +
                      (n.readAt ? '' : 'bg-accent/40')
                    }
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{n.title}</span>
                        <Badge variant="muted" className="text-[10px] uppercase">
                          {n.channel}
                        </Badge>
                        {n.priority && n.priority !== 'NORMAL' && (
                          <Badge
                            variant={
                              n.priority === 'URGENT'
                                ? 'destructive'
                                : n.priority === 'HIGH'
                                  ? 'warning'
                                  : 'muted'
                            }
                            className="text-[10px] uppercase"
                          >
                            {n.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{n.body}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                    </div>
                    {!n.readAt && (
                      <Button size="sm" variant="ghost" onClick={() => markRead.mutate(n.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <PaginationBar
                page={query.data?.meta.page ?? page}
                pageSize={query.data?.meta.pageSize ?? pageSize}
                total={query.data?.meta.total ?? 0}
                onPage={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

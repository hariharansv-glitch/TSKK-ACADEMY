'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Megaphone, MapPin, Users } from 'lucide-react';
import { toast } from 'sonner';

import { apiListRequest, apiRequest, extractErrorMessage } from '@/lib/api-client';
import { formatDateTime, formatINR } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface EventDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  type: string;
  status: string;
  venue: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  startAt: string;
  endAt: string;
  registrationStartAt?: string;
  registrationEndAt?: string;
  capacity?: number;
  feePaise?: number;
  isPaid?: boolean;
  requiresApproval?: boolean;
}

interface Registration {
  id: string;
  registeredAt: string;
  status: string;
  student: { id: string; firstName: string; lastName: string; studentCode: string };
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const event = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiRequest<EventDetail>({ method: 'GET', url: `/events/${id}` }),
  });
  const regs = useQuery({
    queryKey: ['event-registrations', id],
    queryFn: () =>
      apiListRequest<Registration>({
        method: 'GET',
        url: `/events/${id}/registrations`,
        params: { pageSize: 100 },
      }),
    enabled: !!id,
  });

  const publish = useMutation({
    mutationFn: () => apiRequest({ method: 'PATCH', url: `/events/${id}/publish` }),
    onSuccess: () => {
      toast.success('Event published');
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not publish event')),
  });

  if (event.isLoading || !event.data) return <Skeleton className="h-48 w-full" />;
  const e = event.data;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
          <Link href="/dashboard/events">
            <ArrowLeft className="h-4 w-4" /> Events
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{e.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                <Badge variant="muted">{e.type}</Badge>{' '}
                <Badge variant="muted">{e.audience}</Badge>{' '}
                <Badge variant={e.status === 'PUBLISHED' ? 'success' : 'warning'}>{e.status}</Badge>
              </p>
            </div>
            {e.status !== 'PUBLISHED' && (
              <Button loading={publish.isPending} onClick={() => publish.mutate()}>
                <Megaphone className="h-4 w-4" /> Publish
              </Button>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm">{e.description}</p>
          <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                {formatDateTime(e.startAt)} → {formatDateTime(e.endAt)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{[e.venue, e.city].filter(Boolean).join(', ')}</span>
            </div>
            {e.capacity && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Capacity: {e.capacity}</span>
              </div>
            )}
            {e.feePaise != null && (
              <div className="flex items-center gap-2">
                <span>Fee:</span>
                <span className="font-medium text-foreground">{formatINR(e.feePaise / 100)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registrations ({regs.data?.items.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="divide-y text-sm">
          {regs.isLoading && <Skeleton className="h-24 w-full" />}
          {regs.data?.items.length === 0 && (
            <p className="py-6 text-center text-muted-foreground">No registrations yet.</p>
          )}
          {regs.data?.items.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2">
              <div>
                <Link href={`/dashboard/students/${r.student.id}`} className="font-medium underline">
                  {r.student.firstName} {r.student.lastName}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {r.student.studentCode} • {formatDateTime(r.registeredAt)}
                </div>
              </div>
              <Badge variant={r.status === 'CONFIRMED' ? 'success' : 'warning'}>{r.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

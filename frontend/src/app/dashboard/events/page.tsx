'use client';

import { CalendarClock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SimpleListPage, type Column } from '@/components/data/simple-list';
import { formatDateTime } from '@/lib/utils';

interface EventRow {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: 'DRAFT' | 'PUBLISHED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  venue: string;
  startAt: string;
  endAt: string;
  capacity: number | null;
  _count?: { registrations: number };
}

const columns: Column<EventRow>[] = [
  { key: 'title', header: 'Event', render: (r) => <span className="font-medium">{r.title}</span> },
  { key: 'type', header: 'Type', render: (r) => r.type },
  { key: 'venue', header: 'Venue', render: (r) => r.venue },
  { key: 'when', header: 'When', render: (r) => formatDateTime(r.startAt) },
  {
    key: 'registrations',
    header: 'Registered',
    render: (r) =>
      r.capacity ? `${r._count?.registrations ?? 0} / ${r.capacity}` : `${r._count?.registrations ?? 0}`,
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => {
      const map: Record<EventRow['status'], 'muted' | 'info' | 'success' | 'warning' | 'destructive'> = {
        DRAFT: 'muted',
        PUBLISHED: 'info',
        LIVE: 'success',
        COMPLETED: 'muted',
        CANCELLED: 'destructive',
      };
      return <Badge variant={map[r.status]}>{r.status}</Badge>;
    },
  },
];

export default function EventsPage() {
  return (
    <SimpleListPage<EventRow>
      title="Events"
      description="Tournaments, workshops, seminars and gradings hosted by your academy."
      endpoint="/events"
      queryKey={['events']}
      columns={columns}
      emptyIcon={CalendarClock}
      emptyTitle="No events yet"
    />
  );
}

'use client';

import { Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SimpleListPage, type Column } from '@/components/data/simple-list';
import { formatDate } from '@/lib/utils';

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  audience: string[];
  isPinned: boolean;
  publishedAt: string;
  expiresAt: string | null;
}

const columns: Column<AnnouncementRow>[] = [
  {
    key: 'title',
    header: 'Title',
    render: (r) => (
      <div>
        <div className="font-medium">{r.title}</div>
        <div className="line-clamp-1 text-xs text-muted-foreground">{r.body}</div>
      </div>
    ),
  },
  {
    key: 'audience',
    header: 'Audience',
    render: (r) => (
      <div className="flex flex-wrap gap-1">
        {r.audience.map((a) => (
          <Badge key={a} variant="muted" className="text-[10px]">
            {a}
          </Badge>
        ))}
      </div>
    ),
  },
  { key: 'published', header: 'Published', render: (r) => formatDate(r.publishedAt) },
  {
    key: 'expires',
    header: 'Expires',
    render: (r) => (r.expiresAt ? formatDate(r.expiresAt) : '—'),
  },
  {
    key: 'pinned',
    header: '',
    render: (r) => (r.isPinned ? <Badge variant="warning">PINNED</Badge> : null),
  },
];

export default function AnnouncementsPage() {
  return (
    <SimpleListPage<AnnouncementRow>
      title="Announcements"
      description="Broadcasts sent to students, parents, instructors and staff."
      endpoint="/announcements"
      queryKey={['announcements']}
      columns={columns}
      emptyIcon={Megaphone}
      emptyTitle="No announcements yet"
      extraParams={{ activeOnly: false }}
    />
  );
}

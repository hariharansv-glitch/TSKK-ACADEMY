'use client';

import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SimpleListPage, type Column } from '@/components/data/simple-list';
import { formatDate } from '@/lib/utils';

interface VideoRow {
  id: string;
  title: string;
  minBelt: string;
  category: string | null;
  durationSeconds: number | null;
  isPublished: boolean;
  publishedAt: string | null;
  viewCount: number;
  instructor?: { firstName: string; lastName: string } | null;
}

function formatDuration(sec: number | null): string {
  if (!sec) return '—';
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins}:${rem.toString().padStart(2, '0')}`;
}

const columns: Column<VideoRow>[] = [
  { key: 'title', header: 'Title', render: (r) => <span className="font-medium">{r.title}</span> },
  { key: 'belt', header: 'Min. belt', render: (r) => <Badge variant="muted">{r.minBelt}</Badge> },
  { key: 'category', header: 'Category', render: (r) => r.category ?? '—' },
  { key: 'duration', header: 'Duration', render: (r) => formatDuration(r.durationSeconds) },
  { key: 'views', header: 'Views', render: (r) => r.viewCount },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <Badge variant={r.isPublished ? 'success' : 'muted'}>
        {r.isPublished ? 'PUBLISHED' : 'DRAFT'}
      </Badge>
    ),
  },
  { key: 'published', header: 'Published', render: (r) => (r.publishedAt ? formatDate(r.publishedAt) : '—') },
];

export default function LearningPage() {
  return (
    <SimpleListPage<VideoRow>
      title="Learning portal"
      description="Belt-gated video library for structured curriculum delivery."
      endpoint="/learning/videos"
      queryKey={['learning-videos']}
      columns={columns}
      emptyIcon={BookOpen}
      emptyTitle="No videos yet"
      actions={
        <Button asChild variant="outline">
          <Link href="/dashboard/learning/documents">Documents</Link>
        </Button>
      }
      extraParams={{ publishedOnly: false }}
    />
  );
}

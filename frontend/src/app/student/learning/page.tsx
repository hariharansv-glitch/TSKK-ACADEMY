'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Lock, PlayCircle, ShieldCheck } from 'lucide-react';

import { apiListRequest } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

interface VideoRow {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  minBelt: string;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  videoUrl?: string;
  viewCount: number;
}

interface DocRow {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  minBelt: string;
  fileUrl?: string;
  fileSize?: number | null;
  mimeType?: string | null;
}

function formatDuration(sec?: number | null) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function StudentLearningPage() {
  const [search, setSearch] = useState('');

  const videos = useQuery({
    queryKey: ['me-videos', search],
    queryFn: () =>
      apiListRequest<VideoRow>({
        method: 'GET',
        url: '/learning/videos',
        params: { search: search || undefined, pageSize: 60 },
      }),
  });

  const docs = useQuery({
    queryKey: ['me-documents', search],
    queryFn: () =>
      apiListRequest<DocRow>({
        method: 'GET',
        url: '/learning/documents',
        params: { search: search || undefined, pageSize: 60 },
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Learning library</h1>
          <p className="text-sm text-muted-foreground">
            Content is unlocked as you progress through your belts.
          </p>
        </div>
        <Input
          className="max-w-xs"
          placeholder="Search titles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs defaultValue="videos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="space-y-4">
          {videos.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {videos.data?.items.length === 0 && (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nothing available yet.</CardContent></Card>
              )}
              {videos.data?.items.map((v) => (
                <Card key={v.id} className="overflow-hidden">
                  <div className="aspect-video bg-muted">
                    {v.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnailUrl} alt={v.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-muted-foreground">
                        <PlayCircle className="h-12 w-12" />
                      </div>
                    )}
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="line-clamp-2 text-base">{v.title}</CardTitle>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{v.description ?? '—'}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="muted">{v.minBelt}</Badge>
                      {v.category && <Badge variant="outline">{v.category}</Badge>}
                      <span className="text-muted-foreground">{formatDuration(v.durationSeconds)}</span>
                    </div>
                    {v.videoUrl ? (
                      <Button asChild size="sm" className="w-full">
                        <a href={v.videoUrl} target="_blank" rel="noopener noreferrer">
                          <PlayCircle className="h-4 w-4" /> Watch
                        </a>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled className="w-full">
                        <Lock className="h-4 w-4" /> Locked
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-2">
          {docs.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {docs.data?.items.length === 0 && (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No documents available.</CardContent></Card>
              )}
              {docs.data?.items.map((d) => (
                <Card key={d.id}>
                  <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">{d.title}</CardTitle>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{d.description ?? '—'}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="muted"><ShieldCheck className="h-3 w-3" /> {d.minBelt}</Badge>
                      {d.category && <Badge variant="outline">{d.category}</Badge>}
                    </div>
                    {d.fileUrl ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">Open</a>
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" disabled><Lock className="h-4 w-4" /> Locked</Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

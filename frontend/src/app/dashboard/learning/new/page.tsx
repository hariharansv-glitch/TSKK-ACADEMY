'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, extractErrorMessage, api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FormGrid, FormSection } from '@/components/forms/field';

const BELTS = ['WHITE', 'YELLOW', 'ORANGE', 'GREEN', 'BLUE', 'PURPLE', 'BROWN', 'RED', 'BLACK_1', 'BLACK_2', 'BLACK_3'];

export default function NewLearningResourcePage() {
  const router = useRouter();
  const [kind, setKind] = useState<'video' | 'document'>('video');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minBelt, setMinBelt] = useState('WHITE');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (kind === 'video') {
        return apiRequest<{ id: string }>({
          method: 'POST',
          url: '/learning/videos',
          data: {
            title,
            description: description || undefined,
            videoUrl,
            thumbnailUrl: thumbnailUrl || undefined,
            minBelt,
          },
        });
      }
      if (!file) throw new Error('Please pick a file');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title);
      if (description) fd.append('description', description);
      fd.append('minBelt', minBelt);
      const res = await api.post('/learning/documents', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data as { id: string };
    },
    onSuccess: () => {
      toast.success(`${kind === 'video' ? 'Video' : 'Document'} added`);
      router.push('/dashboard/learning');
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not save resource')),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/learning">
              <ArrowLeft className="h-4 w-4" /> Learning
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Add learning resource</h1>
        </div>
        <Button loading={submit.isPending} onClick={() => submit.mutate()}>
          <Upload className="h-4 w-4" /> Save
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resource type</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant={kind === 'video' ? 'default' : 'outline'} onClick={() => setKind('video')}>
            Video
          </Button>
          <Button variant={kind === 'document' ? 'default' : 'outline'} onClick={() => setKind('document')}>
            Document
          </Button>
        </CardContent>
      </Card>

      <FormSection title="Details">
        <FormGrid>
          <Field label="Title" required className="sm:col-span-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Minimum belt" required>
            <Select value={minBelt} onValueChange={setMinBelt}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BELTS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b.replace('_', ' Dan ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {kind === 'video' ? (
            <>
              <Field label="Video URL" required>
                <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Thumbnail URL" className="sm:col-span-2">
                <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} />
              </Field>
            </>
          ) : (
            <Field label="File" required className="sm:col-span-2">
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
          )}
        </FormGrid>
      </FormSection>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Link2, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { apiListRequest, apiRequest, extractErrorMessage } from '@/lib/api-client';
import { useDebouncedValue } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { initials } from '@/lib/utils';

interface Parent {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  phone: string;
  email?: string;
  occupation?: string;
  addressLine1?: string;
  city?: string;
  children: Array<{ id: string; firstName: string; lastName: string; studentCode: string }>;
}

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
}

export default function ParentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);

  const parent = useQuery({
    queryKey: ['parent', id],
    queryFn: () => apiRequest<Parent>({ method: 'GET', url: `/parents/${id}` }),
  });

  const searchStudents = useQuery({
    queryKey: ['parent-add-student', debounced],
    queryFn: () =>
      apiListRequest<StudentRow>({
        method: 'GET',
        url: '/students',
        params: { search: debounced || undefined, pageSize: 6 },
      }),
    enabled: debounced.length > 0,
  });

  const link = useMutation({
    mutationFn: (studentId: string) =>
      apiRequest({ method: 'POST', url: `/parents/${id}/children`, data: { studentId } }),
    onSuccess: () => {
      toast.success('Child linked');
      setSearch('');
      qc.invalidateQueries({ queryKey: ['parent', id] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not link child')),
  });

  const unlink = useMutation({
    mutationFn: (studentId: string) =>
      apiRequest({ method: 'DELETE', url: `/parents/${id}/children/${studentId}` }),
    onSuccess: () => {
      toast.success('Child unlinked');
      qc.invalidateQueries({ queryKey: ['parent', id] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not unlink child')),
  });

  if (parent.isLoading || !parent.data) return <Skeleton className="h-48 w-full" />;
  const p = parent.data;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
          <Link href="/dashboard/parents">
            <ArrowLeft className="h-4 w-4" /> Parents
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback>{initials(`${p.firstName} ${p.lastName}`)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {p.firstName} {p.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {p.relation} • {p.phone}
              {p.email && ` • ${p.email}`}
            </p>
            {(p.addressLine1 || p.city) && (
              <p className="text-sm text-muted-foreground">
                {[p.addressLine1, p.city].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linked children</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {p.children.length === 0 ? (
            <p className="text-sm text-muted-foreground">No children linked yet.</p>
          ) : (
            <ul className="divide-y">
              {p.children.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <Link href={`/dashboard/students/${c.id}`} className="font-medium underline">
                    {c.firstName} {c.lastName}{' '}
                    <span className="font-mono text-xs text-muted-foreground">({c.studentCode})</span>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => unlink.mutate(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">Add a child</p>
            <Input
              placeholder="Search students…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {searchStudents.data && (
              <div className="divide-y rounded-md border">
                {searchStudents.data.items.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2 text-sm">
                    <span>
                      {s.firstName} {s.lastName}{' '}
                      <span className="font-mono text-xs text-muted-foreground">({s.studentCode})</span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={link.isPending}
                      onClick={() => link.mutate(s.id)}
                    >
                      <Link2 className="h-4 w-4" /> Link
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

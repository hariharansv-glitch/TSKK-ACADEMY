'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CheckCircle2, Plus, Search, Trash2, UserCog } from 'lucide-react';
import { toast } from 'sonner';

import { apiListRequest, apiRequest, extractErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FormGrid } from '@/components/forms/field';
import { Skeleton } from '@/components/ui/skeleton';

const ROLES = ['ACADEMY_ADMIN', 'INSTRUCTOR', 'RECEPTIONIST', 'ACCOUNTANT', 'PARENT', 'STUDENT'];

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function UsersManagementPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<string | undefined>(undefined);
  const [creating, setCreating] = useState(false);

  const list = useQuery({
    queryKey: ['users', search, role],
    queryFn: () =>
      apiListRequest<UserRow>({
        method: 'GET',
        url: '/users',
        params: { search: search || undefined, role, pageSize: 50 },
      }),
  });

  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', phone: '', role: 'INSTRUCTOR', sendInvite: true });
  const create = useMutation({
    mutationFn: () =>
      apiRequest({
        method: 'POST',
        url: '/users',
        data: {
          ...form,
          phone: form.phone || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('User invited');
      setCreating(false);
      setForm({ email: '', firstName: '', lastName: '', phone: '', role: 'INSTRUCTOR', sendInvite: true });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const setRoleMutation = useMutation({
    mutationFn: (payload: { id: string; role: string }) =>
      apiRequest({ method: 'POST', url: `/users/${payload.id}/role`, data: { role: payload.role } }),
    onSuccess: () => {
      toast.success('Role updated');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const setStatus = useMutation({
    mutationFn: (payload: { id: string; status: string }) =>
      apiRequest({ method: 'POST', url: `/users/${payload.id}/status`, data: { status: payload.status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest({ method: 'DELETE', url: `/users/${id}` }),
    onSuccess: () => {
      toast.success('User deleted');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
            <Link href="/dashboard/settings"><ArrowLeft className="h-4 w-4" /> Settings</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Invite staff and assign roles.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Invite user</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8" />
        </div>
        <Select value={role ?? 'all'} onValueChange={(v) => setRole(v === 'all' ? undefined : v)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {creating && (
        <Card>
          <CardHeader><CardTitle>Invite user</CardTitle></CardHeader>
          <CardContent>
            <FormGrid>
              <Field label="First name" required><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
              <Field label="Last name" required><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
              <Field label="Email" required><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Role" required>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Send invite email" className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.sendInvite}
                    onChange={(e) => setForm({ ...form, sendInvite: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  Send verification / password setup email
                </label>
              </Field>
            </FormGrid>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              <Button
                loading={create.isPending}
                disabled={!form.email || !form.firstName || !form.lastName}
                onClick={() => create.mutate()}
              >
                Send invite
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {list.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {list.data?.items.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">No users found.</p>
            )}
            {list.data?.items.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 font-medium text-primary">
                    {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-muted-foreground">{u.email} {u.phone ? `· ${u.phone}` : ''}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={u.status === 'ACTIVE' ? 'success' : u.status === 'SUSPENDED' ? 'destructive' : 'muted'}>{u.status}</Badge>
                  <Select value={u.role} onValueChange={(v) => setRoleMutation.mutate({ id: u.id, role: v })}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                  {u.status === 'ACTIVE' ? (
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: u.id, status: 'SUSPENDED' })}>
                      <Ban className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: u.id, status: 'ACTIVE' })}>
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Delete ${u.firstName} ${u.lastName}?`)) remove.mutate(u.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { useAuthStore, type AuthUser } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginForm) => {
    setSubmitting(true);
    try {
      const data = await apiRequest<LoginResponse>({
        method: 'POST',
        url: '/auth/login',
        data: values,
      });
      setSession(data);
      toast.success(`Welcome back, ${data.user.firstName}!`);
      const next = search.get('redirect') ?? routeForRole(data.user.role);
      router.replace(next);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to continue to your academy dashboard.
        </p>
      </header>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-primary underline-offset-2 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            {...register('password')}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to the platform?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an academy
        </Link>
      </p>
    </>
  );
}

function routeForRole(role: AuthUser['role']): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/platform';
    case 'STUDENT':
      return '/student';
    case 'PARENT':
      return '/parent';
    default:
      return '/dashboard';
  }
}

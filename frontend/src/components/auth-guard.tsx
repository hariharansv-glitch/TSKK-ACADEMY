'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore, type UserRole } from '@/store/auth-store';

interface Props {
  roles?: UserRole[];
  children: React.ReactNode;
}

export function AuthGuard({ roles, children }: Props) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || !user) {
      const path = typeof window !== 'undefined' ? window.location.pathname : '/';
      router.replace(`/login?redirect=${encodeURIComponent(path)}`);
      return;
    }
    if (roles && !roles.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [hydrated, token, user, roles, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user || !token) return null;
  if (roles && !roles.includes(user.role)) return null;
  return <>{children}</>;
}

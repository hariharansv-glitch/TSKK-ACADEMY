import { AuthGuard } from '@/components/auth-guard';
import { Topbar } from '@/components/app-shell/topbar';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard roles={['SUPER_ADMIN']}>
      <div className="flex min-h-screen flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </AuthGuard>
  );
}

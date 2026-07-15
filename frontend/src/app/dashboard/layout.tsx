import { AuthGuard } from '@/components/auth-guard';
import { SidebarNav } from '@/components/app-shell/sidebar-nav';
import { Topbar } from '@/components/app-shell/topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard roles={['SUPER_ADMIN', 'ACADEMY_ADMIN', 'INSTRUCTOR', 'RECEPTIONIST', 'ACCOUNTANT']}>
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-border/60 bg-card/40 lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto">
            <SidebarNav />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}

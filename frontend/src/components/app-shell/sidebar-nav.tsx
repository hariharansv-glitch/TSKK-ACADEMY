'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Award,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardList,
  FileBadge,
  GraduationCap,
  Home,
  Layers,
  Megaphone,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  Users2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAuthStore, type UserRole } from '@/store/auth-store';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
  permission?: string;
}

const items: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: Home },
  { href: '/dashboard/students', label: 'Students', icon: GraduationCap, permission: 'student.view' },
  { href: '/dashboard/parents', label: 'Parents', icon: Users2, permission: 'parent.view' },
  { href: '/dashboard/instructors', label: 'Instructors', icon: Users, permission: 'instructor.view' },
  { href: '/dashboard/batches', label: 'Batches', icon: Layers, permission: 'batch.view' },
  { href: '/dashboard/attendance', label: 'Attendance', icon: ClipboardList, permission: 'attendance.view' },
  { href: '/dashboard/fees', label: 'Fees', icon: Receipt, permission: 'fee.view' },
  { href: '/dashboard/belt-exams', label: 'Belt exams', icon: Award, permission: 'belt.view' },
  { href: '/dashboard/certificates', label: 'Certificates', icon: FileBadge, permission: 'certificate.view' },
  { href: '/dashboard/events', label: 'Events', icon: CalendarClock, permission: 'event.view' },
  { href: '/dashboard/learning', label: 'Learning', icon: BookOpen, permission: 'video.view' },
  { href: '/dashboard/inventory', label: 'Inventory', icon: Package, permission: 'inventory.view' },
  { href: '/dashboard/announcements', label: 'Announcements', icon: Megaphone, permission: 'announcement.view' },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/reports', label: 'Reports', icon: ShieldCheck, permission: 'report.view' },
  {
    href: '/dashboard/branches',
    label: 'Branches',
    icon: Building2,
    roles: ['SUPER_ADMIN', 'ACADEMY_ADMIN'],
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['SUPER_ADMIN', 'ACADEMY_ADMIN'],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  if (!user) return null;

  const visible = items.filter((item) => {
    if (item.roles && !item.roles.includes(user.role)) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  });

  return (
    <nav className="flex flex-col gap-1 px-2 py-4">
      {visible.map((item) => {
        const active =
          item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

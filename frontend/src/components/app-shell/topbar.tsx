'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Moon, Sun, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { config } from '@/lib/config';
import { initials } from '@/lib/utils';

export function Topbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);
  const { theme, setTheme } = useTheme();

  const signOut = async () => {
    try {
      await apiRequest({ method: 'POST', url: '/auth/logout', data: { refreshToken } });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      clear();
      router.replace('/login');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur">
      <Link href="/dashboard" className="flex items-center gap-2 font-display text-lg font-bold">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
          {config.appShortName.slice(0, 1)}
        </span>
        <span className="hidden sm:inline">{config.appShortName}</span>
      </Link>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={undefined} />
                <AvatarFallback>{user ? initials(`${user.firstName} ${user.lastName}`) : '?'}</AvatarFallback>
              </Avatar>
              <span className="hidden text-left sm:inline-flex sm:flex-col sm:leading-tight">
                <span className="text-sm font-medium">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-xs text-muted-foreground">{user?.role}</span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[220px]">
            <DropdownMenuLabel>My account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">
                <User className="h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

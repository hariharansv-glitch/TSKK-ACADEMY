import Link from 'next/link';
import { config } from '@/lib/config';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-crimson-700 via-crimson-600 to-saffron-500 lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-primary-foreground">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15 backdrop-blur">
            {config.appShortName.slice(0, 1)}
          </span>
          {config.appShortName}
        </Link>
        <blockquote className="space-y-4">
          <p className="text-2xl font-medium leading-snug">
            "One platform for every silambam kalari — from attendance to certificates, everything just works."
          </p>
          <footer className="text-sm text-white/80">— Founder, {config.appName}</footer>
        </blockquote>
        <p className="text-xs uppercase tracking-widest text-white/70">
          Secure · Multi-tenant · Made in India
        </p>
      </aside>
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

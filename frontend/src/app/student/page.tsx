'use client';

import { Award, BookOpen, ClipboardList, QrCode, Receipt, ScrollText } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function StudentDashboard() {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Namaskaram, {user?.firstName}!</h1>
        <p className="text-sm text-muted-foreground">
          Track your progress, attendance and awarded certificates.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Tile
          href="/student/qr"
          icon={QrCode}
          title="My ID card"
          description="Show this QR code at class check-in."
        />
        <Tile
          href="/student/attendance"
          icon={ClipboardList}
          title="Attendance"
          description="View your check-in history and monthly summary."
        />
        <Tile
          href="/student/fees"
          icon={Receipt}
          title="Fees"
          description="Pending balance, invoices and payment history."
        />
        <Tile
          href="/student/certificates"
          icon={Award}
          title="Certificates"
          description="All certificates awarded to you, ready to download."
        />
        <Tile
          href="/student/learning"
          icon={BookOpen}
          title="Learning"
          description="Videos and documents unlocked for your belt."
        />
        <Tile
          href="/student/assignments"
          icon={ScrollText}
          title="Assignments"
          description="Home tasks and answers submitted to your instructors."
        />
      </div>
    </div>
  );
}

function Tile({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card className="transition-colors hover:border-primary/50">
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="sm">
          <Link href={href}>Open</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

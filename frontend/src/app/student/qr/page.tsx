'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';

import { apiBlobRequest, apiRequest } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';

interface Me {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  currentBelt: string;
  gender: string;
  dateOfBirth: string;
  admissionDate: string;
  photoUrl?: string | null;
  qrCode: string;
  academy?: { name: string; logoUrl?: string };
}

export default function StudentIdCardPage() {
  const me = useQuery({
    queryKey: ['me-student'],
    queryFn: () => apiRequest<Me>({ method: 'GET', url: '/students/me' }),
  });

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked = '';
    let cancelled = false;
    (async () => {
      try {
        const blob = await apiBlobRequest({ method: 'GET', url: '/students/me/qr.png' });
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoked = url;
        setQrDataUrl(url);
      } catch {
        // handled by useQuery status upstream
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, []);

  if (me.isLoading || !me.data) return <Skeleton className="h-64 w-full" />;
  const s = me.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild size="sm" variant="ghost" className="-ml-2 h-7">
          <Link href="/student"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
        <Button onClick={() => window.print()} size="sm">
          <Printer className="h-4 w-4" /> Print ID card
        </Button>
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-md rounded-xl border bg-card p-0 shadow-lg print:shadow-none">
          <div className="rounded-t-xl bg-gradient-to-r from-primary to-primary/80 p-4 text-primary-foreground">
            <p className="text-xs uppercase tracking-widest opacity-80">
              {s.academy?.name ?? 'TSKK Academy'}
            </p>
            <p className="text-xs opacity-70">Official student identity card</p>
          </div>

          <div className="grid grid-cols-[110px_1fr] gap-4 p-5">
            <div className="flex flex-col items-center gap-2">
              {s.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photoUrl} alt={s.firstName} className="h-[110px] w-[110px] rounded-lg border object-cover" />
              ) : (
                <div className="grid h-[110px] w-[110px] place-items-center rounded-lg bg-primary/10 text-3xl font-semibold text-primary">
                  {s.firstName.charAt(0)}{s.lastName.charAt(0)}
                </div>
              )}
              <Badge>{s.currentBelt}</Badge>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-lg font-semibold leading-tight">{s.firstName} {s.lastName}</p>
              </div>
              <Row label="Student ID" value={s.studentCode} mono />
              <Row label="Gender" value={s.gender} />
              <Row label="DOB" value={formatDate(s.dateOfBirth)} />
              <Row label="Joined" value={formatDate(s.admissionDate)} />
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 rounded-b-xl border-t bg-muted/30 p-5">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Student QR" className="h-40 w-40 rounded bg-white p-2" />
            ) : (
              <div className="grid h-40 w-40 place-items-center rounded bg-white text-xs text-muted-foreground">
                Generating…
              </div>
            )}
            <p className="max-w-[240px] text-center text-xs text-muted-foreground">
              Scan this at class to check in. This card is signed — screenshots can be verified.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono' : ''}>{value}</span>
    </div>
  );
}

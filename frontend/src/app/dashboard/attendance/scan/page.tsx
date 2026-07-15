'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { CheckCircle2, Loader2, QrCode, RefreshCcw, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ScanResult {
  attendance: {
    id: string;
    status: 'PRESENT' | 'LATE';
    checkInAt: string;
    minutesLate: number | null;
  };
  student: { id: string; code: string; firstName: string; lastName: string };
}

export default function AttendanceScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastPayload, setLastPayload] = useState<string | null>(null);
  const [recent, setRecent] = useState<Array<{ time: Date; result: ScanResult; error?: string }>>([]);

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  const submitPayload = async (payload: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await apiRequest<ScanResult>({
        method: 'POST',
        url: '/attendance/scan',
        data: { payload },
      });
      const student = result.student;
      toast.success(
        `${result.attendance.status === 'LATE' ? 'Marked LATE' : 'Present'}: ${student.firstName} ${student.lastName}`,
      );
      setRecent((r) => [{ time: new Date(), result }, ...r].slice(0, 8));
    } catch (err) {
      const message = extractErrorMessage(err);
      toast.error(message);
      setRecent((r) => [
        {
          time: new Date(),
          result: {
            attendance: { id: '', status: 'PRESENT', checkInAt: new Date().toISOString(), minutesLate: null },
            student: { id: '', code: payload.slice(0, 20), firstName: 'Unknown', lastName: '' },
          },
          error: message,
        },
        ...r,
      ].slice(0, 8));
    } finally {
      setSubmitting(false);
      setTimeout(() => setLastPayload(null), 2500);
    }
  };

  const startCamera = async () => {
    try {
      const reader = new BrowserQRCodeReader();
      if (!videoRef.current) return;
      setScanning(true);
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (!result) return;
        const text = result.getText();
        if (text === lastPayload) return;
        setLastPayload(text);
        void submitPayload(text);
      });
      controlsRef.current = controls;
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setScanning(false);
    }
  };

  const stopCamera = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scan student QR</h1>
          <p className="text-sm text-muted-foreground">
            Point your camera at a student's ID card to check them in.
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href="/dashboard/attendance">Back to attendance</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Camera</CardTitle>
            {scanning ? (
              <Button size="sm" variant="destructive" onClick={stopCamera}>
                Stop
              </Button>
            ) : (
              <Button size="sm" onClick={startCamera}>
                <QrCode className="h-4 w-4" /> Start scanner
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-black/5">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              {!scanning && (
                <div className="absolute inset-0 grid place-items-center bg-background/70 text-sm text-muted-foreground">
                  Camera stopped
                </div>
              )}
              {submitting && (
                <div className="absolute inset-0 grid place-items-center bg-background/60">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              The scanner submits QR codes automatically. Duplicate scans within a moment are ignored.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent check-ins</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setRecent([])}>
              <RefreshCcw className="h-4 w-4" /> Clear
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scans yet.</p>
            ) : (
              recent.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div>
                    <div className="font-medium">
                      {r.result.student.firstName} {r.result.student.lastName}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">{r.result.student.code}</div>
                  </div>
                  <div className="text-right">
                    {r.error ? (
                      <div className="flex items-center gap-1 text-destructive">
                        <XCircle className="h-4 w-4" />
                        <span className="text-xs">{r.error}</span>
                      </div>
                    ) : (
                      <Badge variant={r.result.attendance.status === 'LATE' ? 'warning' : 'success'}>
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {r.result.attendance.status}
                      </Badge>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.time.toLocaleTimeString('en-IN')}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

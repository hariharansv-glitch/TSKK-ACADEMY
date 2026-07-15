import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { apiUrl } from '@/lib/config';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

interface VerifyResponse {
  success: boolean;
  data: {
    valid: boolean;
    reason?: 'NOT_FOUND' | 'REVOKED' | 'EXPIRED';
    revokedAt?: string;
    revokedReason?: string;
    validUntil?: string;
    certificate?: {
      number: string;
      title: string;
      type: string;
      issuedOn: string;
      validUntil?: string;
      description?: string;
    };
    student?: { firstName: string; lastName: string; studentCode: string; currentBelt: string };
    academy?: { name: string; tagline?: string; logoUrl?: string; city?: string; state?: string };
  };
}

export const dynamic = 'force-dynamic';

async function fetchVerification(code: string): Promise<VerifyResponse['data']> {
  const res = await fetch(apiUrl(`/certificates/verify/${encodeURIComponent(code)}`), {
    next: { revalidate: 0 },
  });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Verification failed with status ${res.status}`);
  const body = (await res.json()) as VerifyResponse;
  return body.data;
}

export default async function VerifyCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const result = await fetchVerification(code);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <Link href="/verify" className="text-sm text-muted-foreground hover:underline">
        ← Verify another certificate
      </Link>

      {result.valid ? (
        <Card className="mt-6 border-emerald-300/40 bg-emerald-50/60 dark:bg-emerald-950/30">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <Badge variant="success">Authentic</Badge>
            </div>
            <CardTitle className="text-2xl">
              {result.certificate?.title ?? 'Certificate verified'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Certificate number" value={result.certificate?.number ?? '—'} />
              <Field label="Type" value={result.certificate?.type ?? '—'} />
              <Field label="Issued on" value={formatDate(result.certificate?.issuedOn)} />
              <Field
                label="Valid until"
                value={result.certificate?.validUntil ? formatDate(result.certificate.validUntil) : '—'}
              />
              <Field
                label="Awarded to"
                value={
                  result.student
                    ? `${result.student.firstName} ${result.student.lastName}`
                    : '—'
                }
              />
              <Field label="Student code" value={result.student?.studentCode ?? '—'} />
              <Field label="Current belt" value={result.student?.currentBelt ?? '—'} />
              <Field
                label="Awarded by"
                value={
                  result.academy
                    ? `${result.academy.name}${result.academy.city ? ` · ${result.academy.city}` : ''}`
                    : '—'
                }
              />
            </div>
            {result.certificate?.description && (
              <p className="rounded-md bg-background/60 p-4 text-sm text-muted-foreground">
                {result.certificate.description}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6 border-destructive/50 bg-destructive/5">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              {result.reason === 'REVOKED' ? (
                <ShieldAlert className="h-5 w-5 text-destructive" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <Badge variant="destructive">Not valid</Badge>
            </div>
            <CardTitle className="text-2xl">
              {result.reason === 'REVOKED'
                ? 'This certificate has been revoked'
                : result.reason === 'EXPIRED'
                  ? 'This certificate has expired'
                  : 'Certificate not found'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {result.reason === 'REVOKED' && (
              <>
                <p>
                  Revoked on <strong>{formatDate(result.revokedAt)}</strong>
                </p>
                {result.revokedReason && (
                  <p>
                    Reason: <em>{result.revokedReason}</em>
                  </p>
                )}
              </>
            )}
            {result.reason === 'EXPIRED' && (
              <p>Certificate validity ended on {formatDate(result.validUntil)}.</p>
            )}
            {result.reason === 'NOT_FOUND' && (
              <p>The verification code you entered doesn't match any certificate on record.</p>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

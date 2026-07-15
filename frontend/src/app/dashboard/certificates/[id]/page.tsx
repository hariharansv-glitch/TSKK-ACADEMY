'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Download, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, extractErrorMessage } from '@/lib/api-client';
import { config } from '@/lib/config';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Certificate {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  verificationUrl: string;
  title: string;
  description?: string;
  type: string;
  issuedOn: string;
  validUntil?: string;
  fileUrl?: string;
  revokedAt?: string | null;
  revokedReason?: string | null;
  student: { id: string; firstName: string; lastName: string; studentCode: string };
}

export default function CertificateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['certificate', id],
    queryFn: () => apiRequest<Certificate>({ method: 'GET', url: `/certificates/${id}` }),
  });
  const cert = query.data;

  const revoke = useMutation({
    mutationFn: () => {
      const reason = window.prompt('Reason for revocation?')?.trim();
      if (!reason) throw new Error('A reason is required to revoke a certificate');
      return apiRequest({ method: 'POST', url: `/certificates/${id}/revoke`, data: { reason } });
    },
    onSuccess: () => {
      toast.success('Certificate revoked');
      queryClient.invalidateQueries({ queryKey: ['certificate', id] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not revoke certificate')),
  });

  if (query.isLoading || !cert) return <Skeleton className="h-48 w-full" />;

  const revoked = !!cert.revokedAt;
  const verifyUrl = cert.verificationUrl || `${config.certVerifyBase}/${cert.verificationCode}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(verifyUrl)}`;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
          <Link href="/dashboard/certificates">
            <ArrowLeft className="h-4 w-4" /> Certificates
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-6 p-6">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{cert.title}</h1>
              <Badge variant={revoked ? 'destructive' : 'success'}>{revoked ? 'REVOKED' : 'ISSUED'}</Badge>
            </div>
            <p className="font-mono text-sm text-muted-foreground">{cert.certificateNumber}</p>
            <p className="text-sm">
              Awarded to{' '}
              <Link href={`/dashboard/students/${cert.student.id}`} className="font-medium underline">
                {cert.student.firstName} {cert.student.lastName}
              </Link>
            </p>
            <p className="text-sm text-muted-foreground">
              Issued {formatDate(cert.issuedOn)}
              {cert.validUntil && ` • Valid until ${formatDate(cert.validUntil)}`}
            </p>
            {cert.description && <p className="mt-2 text-sm">{cert.description}</p>}
            {revoked && cert.revokedReason && (
              <p className="mt-2 text-sm text-destructive">Revoked: {cert.revokedReason}</p>
            )}
          </div>
          <div className="flex flex-col items-center gap-2 rounded-md border p-3">
            <Image src={qrSrc} alt="Verification QR" width={160} height={160} unoptimized />
            <p className="text-xs text-muted-foreground">Scan to verify</p>
            <code className="text-xs">{cert.verificationCode}</code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {cert.fileUrl && (
            <Button asChild variant="outline">
              <a href={cert.fileUrl} target="_blank" rel="noreferrer">
                <Download className="h-4 w-4" /> Download PDF
              </a>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={`/verify/${cert.verificationCode}`} target="_blank">
              <ShieldCheck className="h-4 w-4" /> Public verify
            </Link>
          </Button>
          {!revoked && (
            <Button variant="destructive" loading={revoke.isPending} onClick={() => revoke.mutate()}>
              <Ban className="h-4 w-4" /> Revoke
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

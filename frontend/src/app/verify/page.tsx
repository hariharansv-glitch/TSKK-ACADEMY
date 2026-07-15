'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function VerifyLanding() {
  const [code, setCode] = useState('');
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Verify a Certificate</h1>
        <p className="text-sm text-muted-foreground">
          Enter or paste the verification code found on the certificate to confirm authenticity.
        </p>
      </div>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Verification code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="e.g. 3F7B9A21C4D8"
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
          />
          <Button
            className="w-full"
            disabled={code.length < 4}
            onClick={() => {
              if (code.length < 4) {
                toast.error('Enter a valid verification code');
                return;
              }
              router.push(`/verify/${encodeURIComponent(code)}`);
            }}
          >
            Verify
          </Button>
          <p className="text-xs text-muted-foreground">
            Scanning a certificate QR code will bring you straight here.
          </p>
        </CardContent>
      </Card>
      <Link href="/" className="mt-8 text-sm text-muted-foreground hover:underline">
        Back to home
      </Link>
    </main>
  );
}

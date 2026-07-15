'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, Download, IndianRupee, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

import { apiRequest, apiUrl, extractErrorMessage } from '@/lib/api-client';
import { openRazorpayCheckout, type RazorpayOrder } from '@/lib/razorpay';
import { useAuthStore } from '@/store/auth-store';
import { formatDate, formatINR } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FormGrid, FormSection } from '@/components/forms/field';

interface Invoice {
  id: string;
  invoiceNumber: string;
  type: string;
  status: string;
  amountPaise: number;
  discountPaise: number;
  taxPaise: number;
  lateFeePaise: number;
  totalPaise: number;
  balancePaise: number;
  paidPaise: number;
  dueDate: string;
  createdAt: string;
  notes?: string | null;
  scholarshipReason?: string | null;
  student: { id: string; firstName: string; lastName: string; studentCode: string };
  payments: Array<{
    id: string;
    amountPaise: number;
    method: string;
    paidAt?: string | null;
    reference?: string | null;
    receiptNumber: string;
    status: string;
    refundedAt?: string | null;
  }>;
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const query = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => apiRequest<Invoice>({ method: 'GET', url: `/fees/invoices/${id}` }),
  });
  const invoice = query.data;

  const [payingOnline, setPayingOnline] = useState(false);

  const payOnline = async () => {
    if (!invoice) return;
    try {
      setPayingOnline(true);
      const order = await apiRequest<RazorpayOrder>({
        method: 'POST',
        url: '/fees/razorpay/orders',
        data: { invoiceId: invoice.id },
      });
      await openRazorpayCheckout({
        order,
        name: 'TSKK Academy',
        description: `Invoice ${invoice.invoiceNumber}`,
        prefill: {
          name: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined,
          email: currentUser?.email,
        },
        onSuccess: async (resp) => {
          try {
            await apiRequest({
              method: 'POST',
              url: '/fees/razorpay/verify',
              data: {
                invoiceId: invoice.id,
                razorpayOrderId: resp.razorpay_order_id,
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpaySignature: resp.razorpay_signature,
              },
            });
            toast.success('Payment successful');
            queryClient.invalidateQueries({ queryKey: ['invoice', id] });
          } catch (err) {
            toast.error(extractErrorMessage(err, 'Payment verification failed'));
          }
        },
        onDismiss: () => toast.info('Checkout closed'),
      });
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Unable to start online payment'));
    } finally {
      setPayingOnline(false);
    }
  };

  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  const record = useMutation({
    mutationFn: () =>
      apiRequest({
        method: 'POST',
        url: '/fees/payments',
        data: {
          invoiceId: id,
          amountPaise: Math.round(Number(amount) * 100),
          method,
          reference: reference || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Payment recorded');
      setAmount('');
      setReference('');
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not record payment')),
  });

  const downloadReceipt = (paymentId: string) => {
    const url = apiUrl(`/fees/payments/${paymentId}/receipt.pdf`);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (query.isLoading || !invoice) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="mb-2 -ml-2 h-7">
          <Link href="/dashboard/fees">
            <ArrowLeft className="h-4 w-4" /> Invoices
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div>
            <div className="text-sm text-muted-foreground">Invoice</div>
            <h1 className="font-mono text-2xl font-bold">{invoice.invoiceNumber}</h1>
            <p className="text-sm text-muted-foreground">
              Issued {formatDate(invoice.createdAt)} • Due {formatDate(invoice.dueDate)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="muted">{invoice.type}</Badge>
              <Badge
                variant={
                  invoice.status === 'PAID'
                    ? 'success'
                    : invoice.status === 'OVERDUE'
                      ? 'destructive'
                      : invoice.status === 'PARTIAL'
                        ? 'warning'
                        : 'muted'
                }
              >
                {invoice.status}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-3xl font-bold">{formatINR(invoice.totalPaise / 100)}</div>
            <div className="mt-1 text-sm">
              Paid <span className="font-semibold">{formatINR(invoice.paidPaise / 100)}</span> • Balance{' '}
              <span className="font-semibold">{formatINR(invoice.balancePaise / 100)}</span>
            </div>
            {invoice.balancePaise > 0 && invoice.status !== 'CANCELLED' && (
              <Button className="mt-3" onClick={payOnline} loading={payingOnline}>
                <CreditCard className="h-4 w-4" /> Pay online
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Row label="Amount" value={formatINR(invoice.amountPaise / 100)} />
              <Row label="Discount" value={`- ${formatINR(invoice.discountPaise / 100)}`} />
              <Row label="Tax" value={formatINR(invoice.taxPaise / 100)} />
              <Row label="Late fee" value={formatINR(invoice.lateFeePaise / 100)} />
              <Row label="Total" value={formatINR(invoice.totalPaise / 100)} bold />
              <Row label="Paid" value={formatINR(invoice.paidPaise / 100)} />
              <Row label="Balance" value={formatINR(invoice.balancePaise / 100)} bold />
            </dl>
            {invoice.scholarshipReason && (
              <p className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
                <strong>Scholarship:</strong> {invoice.scholarshipReason}
              </p>
            )}
            {invoice.notes && (
              <p className="mt-2 rounded-md bg-muted/50 p-3 text-sm">
                <strong>Notes:</strong> {invoice.notes}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Student</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">
              {invoice.student.firstName} {invoice.student.lastName}
            </p>
            <p className="font-mono text-xs text-muted-foreground">{invoice.student.studentCode}</p>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href={`/dashboard/students/${invoice.student.id}`}>Open profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {invoice.balancePaise > 0 && invoice.status !== 'CANCELLED' && (
        <FormSection title="Record a payment" description="Offline payments (cash, UPI, bank transfer).">
          <FormGrid>
            <Field label="Method" required>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="RAZORPAY">Razorpay</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Amount (₹)" required>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Reference / Txn ID" className="sm:col-span-2">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
          </FormGrid>
          <div className="flex justify-end">
            <Button disabled={!amount} loading={record.isPending} onClick={() => record.mutate()}>
              <IndianRupee className="h-4 w-4" /> Record payment
            </Button>
          </div>
        </FormSection>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardContent className="divide-y text-sm">
          {invoice.payments.length === 0 && (
            <p className="py-6 text-center text-muted-foreground">No payments recorded yet.</p>
          )}
          {invoice.payments.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <div className="font-medium">{formatINR(p.amountPaise / 100)}</div>
                <div className="text-xs text-muted-foreground">
                  {p.method} • {p.paidAt ? formatDate(p.paidAt) : 'Pending'}
                  {p.reference && ` • ${p.reference}`}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">{p.receiptNumber}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    p.status === 'SUCCESS'
                      ? 'success'
                      : p.status === 'REFUNDED'
                        ? 'warning'
                        : p.status === 'FAILED'
                          ? 'destructive'
                          : 'muted'
                  }
                >
                  {p.status}
                </Badge>
                {p.status === 'SUCCESS' && (
                  <Button size="sm" variant="outline" onClick={() => downloadReceipt(p.id)}>
                    <Download className="h-4 w-4" /> Receipt
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => query.refetch()}>
          <RefreshCcw className="h-4 w-4" /> Refresh
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={'text-right' + (bold ? ' font-semibold' : '')}>{value}</dd>
    </>
  );
}

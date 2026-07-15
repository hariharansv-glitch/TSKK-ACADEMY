// Minimal Razorpay checkout helper. Loads the SDK on demand and opens the
// modal against an order created by our backend.

export interface RazorpayOrder {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  invoice: { id: string; number: string; balancePaise: number };
}

export interface RazorpaySuccessPayload {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let scriptPromise: Promise<void> | null = null;
const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

export function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Not in browser'));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SCRIPT_URL;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load Razorpay SDK'));
    };
    document.body.appendChild(el);
  });
  return scriptPromise;
}

export interface OpenCheckoutOptions {
  order: RazorpayOrder;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  themeColor?: string;
  onSuccess: (payload: RazorpaySuccessPayload) => void | Promise<void>;
  onDismiss?: () => void;
}

export async function openRazorpayCheckout(opts: OpenCheckoutOptions): Promise<void> {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error('Razorpay SDK not available');

  const rz = new window.Razorpay({
    key: opts.order.keyId,
    amount: opts.order.amount,
    currency: opts.order.currency,
    order_id: opts.order.orderId,
    name: opts.name,
    description: opts.description ?? `Invoice ${opts.order.invoice.number}`,
    prefill: opts.prefill,
    theme: { color: opts.themeColor ?? '#0ea5e9' },
    handler: (resp: RazorpaySuccessPayload) => {
      void opts.onSuccess(resp);
    },
    modal: {
      ondismiss: () => opts.onDismiss?.(),
    },
  });
  rz.open();
}

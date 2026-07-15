import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import Razorpay from 'razorpay';
import type { EnvVars } from '@config/env.validation';

/**
 * Thin Razorpay wrapper. If Razorpay credentials are not configured, the
 * service throws a clean 503 rather than crashing the app.
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private client: Razorpay | null = null;

  constructor(private readonly config: ConfigService<EnvVars, true>) {
    const keyId = config.get('RAZORPAY_KEY_ID', { infer: true });
    const keySecret = config.get('RAZORPAY_KEY_SECRET', { infer: true });
    if (keyId && keySecret) {
      this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    } else {
      this.logger.warn('Razorpay credentials not configured — online payments disabled');
    }
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  get keyId(): string {
    return this.config.get('RAZORPAY_KEY_ID', { infer: true });
  }

  async createOrder(params: {
    amountPaise: number;
    currency?: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ id: string; amount: number; currency: string }> {
    if (!this.client) throw new ServiceUnavailableException('Payment gateway not configured');
    const order = await this.client.orders.create({
      amount: params.amountPaise,
      currency: params.currency ?? 'INR',
      receipt: params.receipt.slice(0, 40),
      notes: params.notes,
      payment_capture: true,
    });
    return { id: order.id, amount: Number(order.amount), currency: order.currency };
  }

  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
    const keySecret = this.config.get('RAZORPAY_KEY_SECRET', { infer: true });
    if (!keySecret) return false;
    const expected = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    return expected === signature;
  }

  verifyWebhookSignature(bodyRaw: string, signature: string): boolean {
    const secret = this.config.get('RAZORPAY_WEBHOOK_SECRET', { infer: true });
    if (!secret) return false;
    const expected = createHmac('sha256', secret).update(bodyRaw).digest('hex');
    return expected === signature;
  }

  async refund(paymentId: string, amountPaise?: number): Promise<{ id: string; amount: number; status: string }> {
    if (!this.client) throw new ServiceUnavailableException('Payment gateway not configured');
    try {
      const refund = await this.client.payments.refund(paymentId, {
        ...(amountPaise ? { amount: amountPaise } : {}),
        speed: 'normal',
      });
      return { id: refund.id, amount: Number(refund.amount), status: refund.status };
    } catch (err) {
      this.logger.error(`Refund failed for payment ${paymentId}: ${(err as Error).message}`);
      throw new BadRequestException(`Refund failed: ${(err as Error).message}`);
    }
  }
}

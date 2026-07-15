import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import type { EnvVars } from '@config/env.validation';

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

@Injectable()
export class PushChannel {
  private readonly logger = new Logger(PushChannel.name);
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService<EnvVars, true>) {
    const publicKey = config.get('VAPID_PUBLIC_KEY', { infer: true });
    const privateKey = config.get('VAPID_PRIVATE_KEY', { infer: true });
    const subject = config.get('VAPID_SUBJECT', { infer: true });
    this.enabled = Boolean(publicKey && privateKey);
    if (this.enabled) {
      webPush.setVapidDetails(subject, publicKey, privateKey);
    } else {
      this.logger.warn('VAPID keys not configured — Web Push disabled');
    }
  }

  get isConfigured(): boolean {
    return this.enabled;
  }

  get publicKey(): string {
    return this.config.get('VAPID_PUBLIC_KEY', { infer: true });
  }

  async send(
    subscription: PushSubscriptionPayload,
    payload: { title: string; body: string; url?: string; data?: Record<string, unknown> },
  ): Promise<{ statusCode: number }> {
    if (!this.enabled) throw new Error('Push channel is not configured');
    const result = await webPush.sendNotification(
      subscription as unknown as webPush.PushSubscription,
      JSON.stringify(payload),
      { TTL: 60 * 60 },
    );
    return { statusCode: result.statusCode };
  }
}

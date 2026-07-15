import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvVars } from '@config/env.validation';

/**
 * WhatsApp Cloud API (Meta Business Platform) sender.
 * Uses the raw HTTP endpoint so we don't pull in the entire SDK.
 */
@Injectable()
export class WhatsappChannel {
  private readonly logger = new Logger(WhatsappChannel.name);
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly apiVersion = 'v18.0';

  constructor(private readonly config: ConfigService<EnvVars, true>) {
    this.phoneNumberId = config.get('WHATSAPP_PHONE_NUMBER_ID', { infer: true });
    this.accessToken = config.get('WHATSAPP_ACCESS_TOKEN', { infer: true });
    if (!this.isConfigured) {
      this.logger.warn('WhatsApp Cloud API not configured — WhatsApp delivery disabled');
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.phoneNumberId && this.accessToken);
  }

  async sendText(to: string, body: string): Promise<{ id: string; status: string }> {
    if (!this.isConfigured) throw new Error('WhatsApp channel is not configured');
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: body.slice(0, 4096) },
      }),
    });
    const json = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message?: string } };
    if (!res.ok) {
      throw new Error(`WhatsApp send failed: ${json.error?.message ?? res.statusText}`);
    }
    return { id: json.messages?.[0]?.id ?? '', status: 'sent' };
  }

  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    components?: unknown[],
  ): Promise<{ id: string; status: string }> {
    if (!this.isConfigured) throw new Error('WhatsApp channel is not configured');
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    });
    const json = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message?: string } };
    if (!res.ok) throw new Error(`WhatsApp template send failed: ${json.error?.message ?? res.statusText}`);
    return { id: json.messages?.[0]?.id ?? '', status: 'sent' };
  }
}

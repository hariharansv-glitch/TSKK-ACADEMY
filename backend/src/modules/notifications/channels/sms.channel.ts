import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import type { EnvVars } from '@config/env.validation';

@Injectable()
export class SmsChannel {
  private readonly logger = new Logger(SmsChannel.name);
  private client: ReturnType<typeof twilio> | null = null;
  private fromNumber = '';

  constructor(private readonly config: ConfigService<EnvVars, true>) {
    const sid = config.get('TWILIO_ACCOUNT_SID', { infer: true });
    const token = config.get('TWILIO_AUTH_TOKEN', { infer: true });
    this.fromNumber = config.get('TWILIO_FROM_NUMBER', { infer: true });
    if (sid && token && this.fromNumber) {
      this.client = twilio(sid, token);
    } else {
      this.logger.warn('Twilio credentials not configured — SMS delivery disabled');
    }
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async send(to: string, body: string): Promise<{ id: string; status: string }> {
    if (!this.client) throw new Error('SMS channel is not configured');
    const message = await this.client.messages.create({
      to,
      from: this.fromNumber,
      body,
    });
    return { id: message.sid, status: message.status };
  }
}

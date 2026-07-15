import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import * as Handlebars from 'handlebars';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { EnvVars } from '@config/env.validation';

interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: nodemailer.SendMailOptions['attachments'];
}

@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter!: Transporter;
  private readonly cache = new Map<string, HandlebarsTemplateDelegate>();
  private readonly templateDir = path.resolve(__dirname, 'templates');

  constructor(private readonly config: ConfigService<EnvVars, true>) {}

  async onModuleInit(): Promise<void> {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', { infer: true }),
      port: Number(this.config.get('SMTP_PORT', { infer: true })),
      secure: Boolean(this.config.get('SMTP_SECURE', { infer: true })),
      auth: this.config.get('SMTP_USER', { infer: true })
        ? {
            user: this.config.get('SMTP_USER', { infer: true }),
            pass: this.config.get('SMTP_PASSWORD', { infer: true }),
          }
        : undefined,
    });
    try {
      await this.transporter.verify();
      this.logger.log('SMTP transport verified');
    } catch (err) {
      this.logger.warn(`SMTP transport verification failed: ${(err as Error).message}`);
    }
    this.registerHelpers();
    await this.registerPartials();
  }

  private registerHelpers(): void {
    Handlebars.registerHelper('year', () => new Date().getFullYear());
    Handlebars.registerHelper('upper', (v: string) => (v ?? '').toString().toUpperCase());
  }

  private async registerPartials(): Promise<void> {
    try {
      const entries = await fs.readdir(this.templateDir).catch(() => [] as string[]);
      for (const entry of entries) {
        if (!entry.startsWith('_') || !entry.endsWith('.hbs')) continue;
        const raw = await fs.readFile(path.join(this.templateDir, entry), 'utf8');
        const name = entry.replace(/\.hbs$/, '');
        Handlebars.registerPartial(name, raw);
      }
    } catch (err) {
      this.logger.warn(`Could not register email partials: ${(err as Error).message}`);
    }
  }

  private async loadTemplate(name: string): Promise<HandlebarsTemplateDelegate> {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const file = path.join(this.templateDir, `${name}.hbs`);
    const raw = await fs.readFile(file, 'utf8');
    const compiled = Handlebars.compile(raw, { noEscape: false });
    this.cache.set(name, compiled);
    return compiled;
  }

  async renderTemplate(name: string, ctx: Record<string, unknown>): Promise<RenderedTemplate> {
    const html = (await this.loadTemplate(name))(ctx);
    const subject = this.extractSubject(html) ?? (ctx.subject as string) ?? 'TSKK Academy';
    const text = html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return { subject, html, text };
  }

  private extractSubject(html: string): string | undefined {
    const m = html.match(/<!--\s*subject:\s*(.+?)\s*-->/i);
    return m?.[1];
  }

  async send(opts: SendOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.config.get('SMTP_FROM', { infer: true }),
        to: opts.to,
        cc: opts.cc,
        bcc: opts.bcc,
        replyTo: opts.replyTo,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        attachments: opts.attachments,
      });
      this.logger.log(`Mail sent to ${opts.to}: "${opts.subject}"`);
    } catch (err) {
      this.logger.error(`Mail send failed for ${opts.to}: ${(err as Error).message}`);
      throw err;
    }
  }

  async sendTemplate(
    to: string,
    templateName: string,
    context: Record<string, unknown>,
    overrides: Partial<SendOptions> = {},
  ): Promise<void> {
    const rendered = await this.renderTemplate(templateName, context);
    await this.send({
      to,
      subject: overrides.subject ?? rendered.subject,
      html: rendered.html,
      text: rendered.text,
      ...overrides,
    });
  }
}

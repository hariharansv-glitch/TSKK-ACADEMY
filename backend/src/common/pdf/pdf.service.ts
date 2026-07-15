import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { Browser, LaunchOptions, PDFOptions } from 'puppeteer';

interface RenderOptions {
  templatePath: string;
  context: Record<string, unknown>;
  pdfOptions?: PDFOptions;
}

interface RenderHtmlOptions {
  html: string;
  pdfOptions?: PDFOptions;
}

/**
 * Renders HTML → PDF using a single lazy-launched Puppeteer browser.
 * The browser is reused across requests and closed on module shutdown.
 * Templates are Handlebars files cached in memory after first read.
 */
@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: Browser | null = null;
  private browserPromise: Promise<Browser> | null = null;
  private readonly templates = new Map<string, HandlebarsTemplateDelegate>();

  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    if (!this.browserPromise) {
      this.browserPromise = (async () => {
        const puppeteer = await import('puppeteer');
        const opts: LaunchOptions = {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--font-render-hinting=none',
          ],
        };
        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
          opts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        }
        this.browser = await puppeteer.launch(opts);
        this.browser.on('disconnected', () => {
          this.logger.warn('Puppeteer browser disconnected — will relaunch on next render');
          this.browser = null;
          this.browserPromise = null;
        });
        return this.browser;
      })();
    }
    return this.browserPromise;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (err) {
        this.logger.warn(`Failed to close Puppeteer: ${(err as Error).message}`);
      }
      this.browser = null;
      this.browserPromise = null;
    }
  }

  private async loadTemplate(templatePath: string): Promise<HandlebarsTemplateDelegate> {
    const cached = this.templates.get(templatePath);
    if (cached) return cached;
    const abs = path.isAbsolute(templatePath)
      ? templatePath
      : path.resolve(process.cwd(), templatePath);
    const raw = await fs.readFile(abs, 'utf8');
    const compiled = Handlebars.compile(raw, { noEscape: false });
    this.templates.set(templatePath, compiled);
    return compiled;
  }

  async renderTemplate(opts: RenderOptions): Promise<Buffer> {
    const template = await this.loadTemplate(opts.templatePath);
    const html = template({ ...opts.context, year: new Date().getFullYear() });
    return this.renderHtml({ html, pdfOptions: opts.pdfOptions });
  }

  async renderHtml(opts: RenderHtmlOptions): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(opts.html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        ...opts.pdfOptions,
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }
}

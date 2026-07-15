import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * PrismaService — a thin wrapper around PrismaClient.
 *
 * - Enables query logging in non-production.
 * - Adds an idempotent connect / disconnect lifecycle.
 * - Provides `truncateAll` used only by test setup (guarded by NODE_ENV).
 * - Provides `withTransaction` helper that carries a tenant id into every call.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'production'
          ? [{ emit: 'event', level: 'error' }, { emit: 'event', level: 'warn' }]
          : [
              { emit: 'event', level: 'query' },
              { emit: 'event', level: 'info' },
              { emit: 'event', level: 'warn' },
              { emit: 'event', level: 'error' },
            ],
      errorFormat: 'colorless',
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }

  /**
   * Wipe every table. Guarded: refuses to run outside `test`.
   */
  async truncateAll(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('truncateAll may only be invoked when NODE_ENV=test');
    }
    const tables = await this.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
    const names = tables
      .map((t) => `"public"."${t.tablename}"`)
      .filter((n) => !n.includes('_prisma_migrations'))
      .join(', ');
    if (names.length > 0) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
    }
  }

  /**
   * Convenience helper for interactive transactions with a shorter signature.
   */
  withTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(fn, { maxWait: 5_000, timeout: 15_000 });
  }
}

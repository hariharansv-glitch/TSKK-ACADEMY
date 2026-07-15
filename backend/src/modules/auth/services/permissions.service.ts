import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';

/**
 * Loads the permission catalogue from the DB into an in-memory map keyed by role.
 * Refreshes every 5 minutes and can be manually invalidated via `invalidate()`.
 */
@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);
  private map = new Map<UserRole, string[]>();
  private loadedAt = 0;
  private readonly ttlMs = 5 * 60 * 1000;
  private inflight: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  invalidate(): void {
    this.loadedAt = 0;
  }

  async getForRole(role: UserRole): Promise<string[]> {
    if (Date.now() - this.loadedAt > this.ttlMs) await this.refresh();
    return this.map.get(role) ?? [];
  }

  private async refresh(): Promise<void> {
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      try {
        const rows = await this.prisma.rolePermission.findMany({
          select: { role: true, permissionKey: true },
        });
        const next = new Map<UserRole, string[]>();
        for (const r of rows) {
          const list = next.get(r.role) ?? [];
          list.push(r.permissionKey);
          next.set(r.role, list);
        }
        this.map = next;
        this.loadedAt = Date.now();
        this.logger.log(`Loaded permissions for ${next.size} roles`);
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { PrismaService } from '@database/prisma.service';

@ApiTags('health')
@Controller({ path: 'health', version: undefined })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async live() {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  async ready() {
    const started = Date.now();
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return {
        status: 'ready',
        database: 'ok',
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        status: 'degraded',
        database: 'error',
        error: (err as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

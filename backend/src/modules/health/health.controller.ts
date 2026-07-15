import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { PrismaService } from '@database/prisma.service';

@ApiTags('health')
// IMPORTANT: `VERSION_NEUTRAL` (not `undefined`) is required here. With
// `app.enableVersioning({ type: URI, defaultVersion: '1' })` in main.ts,
// a controller with `version: undefined` implicitly inherits the default
// version, which would mount these routes at `/v1/health` and
// `/v1/health/ready`. That doesn't match what the docker HEALTHCHECK,
// the Jenkins `Wait for App` stage, and load balancers all expect
// (unversioned `/health`). `VERSION_NEUTRAL` opts this controller out of
// versioning entirely so the routes stay at their canonical paths, which
// is also exactly what main.ts's `setGlobalPrefix({ exclude: [...] })`
// already assumes.
@Controller({ path: 'health', version: VERSION_NEUTRAL })
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

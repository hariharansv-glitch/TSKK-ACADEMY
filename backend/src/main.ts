import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { validateEnv } from '@config/env.validation';

async function bootstrap(): Promise<void> {
  const env = validateEnv(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();

  // ── Security & platform middleware ─────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const corsOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin || corsOrigins.length === 0 || corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });

  // ── Global prefix + versioning ─────────────────────────────────────────────
  const [prefix, versionPart] = env.API_PREFIX.split('/');
  app.setGlobalPrefix(prefix, {
    exclude: [{ path: 'health', method: 6 /* ALL */ }, { path: 'health/ready', method: 6 }],
  });
  if (versionPart && /^v\d+$/i.test(versionPart)) {
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: versionPart.replace(/^v/i, ''),
    });
  }

  // ── OpenAPI / Swagger ──────────────────────────────────────────────────────
  const swagger = new DocumentBuilder()
    .setTitle('TSKK Academy API')
    .setDescription('Tamilar Silamba Kalai Koodam — Academy Management System REST API')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addServer(env.API_URL)
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  // ── Reflector-based validation happens per-route via ZodValidationPipe ─────
  app.useGlobalPipes();

  await app.listen(env.BACKEND_PORT, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 TSKK API ready on http://0.0.0.0:${env.BACKEND_PORT}/${env.API_PREFIX}`);
  logger.log(`📖 Swagger docs on http://0.0.0.0:${env.BACKEND_PORT}/docs`);
  // Reflector is captured for downstream diagnostic tooling.
  app.get(Reflector);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});

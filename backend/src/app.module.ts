import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { validateEnv } from '@config/env.validation';
import { buildConfig } from '@config/configuration';
import { PrismaModule } from '@database/prisma.module';

import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';
import { TransformInterceptor } from '@common/interceptors/transform.interceptor';
import { TimeoutInterceptor } from '@common/interceptors/timeout.interceptor';
import { RequestIdMiddleware } from '@common/middleware/request-id.middleware';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { PermissionsGuard } from '@common/guards/permissions.guard';

import { CommonModule } from '@common/common.module';
import { StorageModule } from '@common/storage/storage.module';
import { PdfModule } from '@common/pdf/pdf.module';
import { HealthModule } from '@modules/health/health.module';
import { MailerModule } from '@modules/mailer/mailer.module';
import { AuthModule } from '@modules/auth/auth.module';
import { AcademiesModule } from '@modules/academies/academies.module';
import { BranchesModule } from '@modules/branches/branches.module';
import { UsersModule } from '@modules/users/users.module';
import { StudentsModule } from '@modules/students/students.module';
import { ParentsModule } from '@modules/parents/parents.module';
import { InstructorsModule } from '@modules/instructors/instructors.module';
import { AttendanceModule } from '@modules/attendance/attendance.module';
import { FeesModule } from '@modules/fees/fees.module';
import { CertificatesModule } from '@modules/certificates/certificates.module';
import { BeltsModule } from '@modules/belts/belts.module';
import { EventsModule } from '@modules/events/events.module';
import { LearningModule } from '@modules/learning/learning.module';
import { InventoryModule } from '@modules/inventory/inventory.module';
import { AnnouncementsModule } from '@modules/announcements/announcements.module';
import { BatchesModule } from '@modules/batches/batches.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { ReportsModule } from '@modules/reports/reports.module';
import { SettingsModule } from '@modules/settings/settings.module';
import { AuditModule } from '@modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../.env'],
      validate: (raw) => {
        const env = validateEnv(raw);
        (global as unknown as { __rootConfig?: unknown }).__rootConfig = buildConfig(env);
        return env;
      },
    }),

    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                  translateTime: 'HH:MM:ss.l',
                },
              },
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
          '*.passwordHash',
        ],
        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
      },
    }),

    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
        limit: Number(process.env.THROTTLE_LIMIT ?? 120),
      },
    ]),

    ScheduleModule.forRoot(),

    PrismaModule,
    CommonModule,
    StorageModule,
    PdfModule,
    MailerModule,
    AuthModule,
    AcademiesModule,
    BranchesModule,
    UsersModule,
    StudentsModule,
    ParentsModule,
    InstructorsModule,
    AttendanceModule,
    FeesModule,
    CertificatesModule,
    BeltsModule,
    EventsModule,
    LearningModule,
    InventoryModule,
    AnnouncementsModule,
    BatchesModule,
    NotificationsModule,
    ReportsModule,
    SettingsModule,
    AuditModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

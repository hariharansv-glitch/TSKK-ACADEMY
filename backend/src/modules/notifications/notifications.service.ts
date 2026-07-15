import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { MailerService } from '@modules/mailer/mailer.service';
import { AuditLogService } from '@common/services/audit-log.service';
import { paginate } from '@common/dto/paginated-response.dto';
import { SmsChannel } from './channels/sms.channel';
import { WhatsappChannel } from './channels/whatsapp.channel';
import { PushChannel } from './channels/push.channel';
import type {
  ListNotificationsQuery,
  RegisterPushInput,
  SendNotificationInput,
} from './dto/notification.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';

interface Recipient {
  id: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly mailer: MailerService,
    private readonly sms: SmsChannel,
    private readonly whatsapp: WhatsappChannel,
    private readonly push: PushChannel,
  ) {}

  // ── Send a notification to one or more users / roles ─────────────────────
  async send(academyId: string | null, input: SendNotificationInput, req: AuthenticatedRequest) {
    const recipients = await this.resolveRecipients(academyId, input);
    if (recipients.length === 0) {
      return { queued: 0, sent: 0, failed: 0, notifications: [] };
    }

    const settings = academyId
      ? await this.prisma.academySetting.findUnique({ where: { academyId } })
      : null;

    const notifications: Awaited<ReturnType<typeof this.prisma.notification.create>>[] = [];
    for (const recipient of recipients) {
      for (const channel of input.channels) {
        if (settings) {
          if (channel === NotificationChannel.EMAIL && !settings.emailEnabled) continue;
          if (channel === NotificationChannel.SMS && !settings.smsEnabled) continue;
          if (channel === NotificationChannel.WHATSAPP && !settings.whatsappEnabled) continue;
          if (channel === NotificationChannel.PUSH && !settings.pushEnabled) continue;
        }
        const notification = await this.prisma.notification.create({
          data: {
            academyId: academyId ?? undefined,
            userId: recipient.id,
            channel,
            status: input.scheduledFor ? NotificationStatus.QUEUED : NotificationStatus.QUEUED,
            priority: input.priority ?? NotificationPriority.NORMAL,
            subject: input.subject,
            body: input.body,
            templateId: input.templateId,
            data: input.data as Prisma.InputJsonValue | undefined,
          },
        });
        notifications.push(notification);
      }
    }

    if (!input.scheduledFor) {
      await Promise.allSettled(notifications.map((n) => this.deliver(n.id)));
    }

    await this.audit.fromRequest(req, 'NOTIFY', 'Notification', null, {
      after: { recipients: recipients.length, channels: input.channels, priority: input.priority },
    });
    return {
      queued: notifications.length,
      recipients: recipients.length,
      notifications: notifications.map((n) => ({ id: n.id, channel: n.channel, status: n.status })),
    };
  }

  // ── Deliver a single queued notification ─────────────────────────────────
  async deliver(notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true, role: true } },
      },
    });
    if (!notification) return;
    if (notification.status !== NotificationStatus.QUEUED) return;

    try {
      switch (notification.channel) {
        case NotificationChannel.EMAIL: {
          if (!notification.user?.email) throw new Error('Recipient has no email address');
          if (notification.templateId) {
            await this.mailer.sendTemplate(
              notification.user.email,
              notification.templateId,
              {
                ...((notification.data as Record<string, unknown> | null) ?? {}),
                body: notification.body,
                firstName: notification.user.firstName,
              },
              { subject: notification.subject ?? undefined },
            );
          } else {
            await this.mailer.send({
              to: notification.user.email,
              subject: notification.subject ?? 'Notification',
              html: this.textToHtml(notification.body),
              text: notification.body,
            });
          }
          break;
        }
        case NotificationChannel.SMS: {
          if (!notification.user?.phone) throw new Error('Recipient has no phone number');
          if (!this.sms.isConfigured) throw new Error('SMS channel not configured');
          await this.sms.send(notification.user.phone, notification.body);
          break;
        }
        case NotificationChannel.WHATSAPP: {
          if (!notification.user?.phone) throw new Error('Recipient has no phone number');
          if (!this.whatsapp.isConfigured) throw new Error('WhatsApp channel not configured');
          await this.whatsapp.sendText(notification.user.phone, notification.body);
          break;
        }
        case NotificationChannel.PUSH: {
          if (!this.push.isConfigured) throw new Error('Push channel not configured');
          const subs = await this.prisma.pushSubscription.findMany({
            where: { userId: notification.userId ?? '' },
          });
          for (const sub of subs) {
            try {
              await this.push.send(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.authKey } },
                {
                  title: notification.subject ?? 'Notification',
                  body: notification.body,
                  data: (notification.data as Record<string, unknown> | null) ?? undefined,
                },
              );
            } catch (err) {
              const status = (err as { statusCode?: number }).statusCode;
              if (status === 404 || status === 410) {
                await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
              } else {
                throw err;
              }
            }
          }
          break;
        }
        case NotificationChannel.IN_APP:
          break;
        default:
          throw new Error(`Unsupported channel ${notification.channel}`);
      }

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          deliveredAt: notification.channel === NotificationChannel.IN_APP ? new Date() : null,
        },
      });
    } catch (err) {
      this.logger.warn(`Notification ${notification.id} failed: ${(err as Error).message}`);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          failedAt: new Date(),
          errorMessage: (err as Error).message.slice(0, 500),
          retries: { increment: 1 },
        },
      });
    }
  }

  // ── Resolve recipients from userIds + roles ─────────────────────────────
  private async resolveRecipients(academyId: string | null, input: SendNotificationInput): Promise<Recipient[]> {
    const ids = new Set<string>(input.userIds ?? []);
    if (input.roles && input.roles.length > 0) {
      const rows = await this.prisma.user.findMany({
        where: {
          ...(academyId ? { academyId } : {}),
          role: { in: input.roles },
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      rows.forEach((r) => ids.add(r.id));
    }
    if (ids.size === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(ids) }, deletedAt: null, isActive: true },
      select: { id: true, email: true, phone: true, role: true },
    });
    return users;
  }

  private textToHtml(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />');
    return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;font-size:14px;line-height:1.6;">${escaped}</div>`;
  }

  // ── Listing (admin + self) ───────────────────────────────────────────────
  async list(academyId: string | null, actor: AuthenticatedUser, query: ListNotificationsQuery) {
    const where: Prisma.NotificationWhereInput = {
      ...(academyId ? { academyId } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.unreadOnly ? { readAt: null } : {}),
    };
    if (actor.role !== UserRole.SUPER_ADMIN && actor.role !== UserRole.ACADEMY_ADMIN) {
      where.userId = actor.id;
    }
    const [total, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async markRead(id: string, actor: AuthenticatedUser) {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    if (!row || (row.userId && row.userId !== actor.id && actor.role !== UserRole.SUPER_ADMIN)) {
      throw new NotFoundException('Notification not found');
    }
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(actor: AuthenticatedUser) {
    return this.prisma.notification.updateMany({
      where: { userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  // ── Push subscriptions ───────────────────────────────────────────────────
  async registerPushSubscription(actor: AuthenticatedUser, input: RegisterPushInput) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId: actor.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        authKey: input.keys.auth,
        userAgent: input.userAgent,
      },
      update: {
        userId: actor.id,
        p256dh: input.keys.p256dh,
        authKey: input.keys.auth,
        userAgent: input.userAgent,
      },
    });
  }

  async removePushSubscription(actor: AuthenticatedUser, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId: actor.id, endpoint } });
    return { deleted: true };
  }

  getPublicVapidKey(): { publicKey: string | null } {
    return { publicKey: this.push.isConfigured ? this.push.publicKey : null };
  }
}

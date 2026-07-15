import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { AuditLogService } from '@common/services/audit-log.service';
import { paginate } from '@common/dto/paginated-response.dto';
import { slugify } from '@common/utils/ids.util';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';
import type { CreateEventInput, ListEventsQuery, UpdateEventInput } from './dto/event.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async create(academyId: string, input: CreateEventInput, req: AuthenticatedRequest) {
    const slug = input.slug ?? (await this.uniqueSlug(academyId, input.title));
    try {
      const event = await this.prisma.event.create({
        data: {
          academyId,
          slug,
          title: input.title,
          description: input.description,
          type: input.type,
          status: input.status ?? EventStatus.DRAFT,
          bannerUrl: input.bannerUrl,
          venue: input.venue,
          addressLine1: input.addressLine1,
          city: input.city,
          state: input.state,
          startAt: input.startAt,
          endAt: input.endAt,
          registrationStartAt: input.registrationStartAt,
          registrationEndAt: input.registrationEndAt,
          capacity: input.capacity,
          feePaise: input.feePaise ?? 0,
          isPaid: input.isPaid ?? (input.feePaise ?? 0) > 0,
          requiresApproval: input.requiresApproval ?? false,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      await this.audit.fromRequest(req, 'CREATE', 'Event', event.id, { after: event });
      return event;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('An event with this slug already exists in this academy');
      }
      throw err;
    }
  }

  async list(academyId: string, actor: AuthenticatedUser, query: ListEventsQuery) {
    const where: Prisma.EventWhereInput = {
      academyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.upcomingOnly ? { endAt: { gte: new Date() } } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { venue: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    if (![UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR, UserRole.RECEPTIONIST].includes(actor.role)) {
      where.status = { in: [EventStatus.PUBLISHED, EventStatus.LIVE, EventStatus.COMPLETED] };
    }
    const [total, rows] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        orderBy: [{ startAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { _count: { select: { registrations: true } } },
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async findOne(academyId: string, id: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, academyId },
      include: {
        gallery: { orderBy: { ordinal: 'asc' } },
        _count: { select: { registrations: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async findBySlug(academyId: string, slug: string) {
    const event = await this.prisma.event.findFirst({
      where: { academyId, slug },
      include: {
        gallery: { orderBy: { ordinal: 'asc' } },
        _count: { select: { registrations: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async update(academyId: string, id: string, input: UpdateEventInput, req: AuthenticatedRequest) {
    const before = await this.prisma.event.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Event not found');
    const after = await this.prisma.event.update({
      where: { id },
      data: {
        ...input,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    await this.audit.fromRequest(req, 'UPDATE', 'Event', id, { before, after });
    return after;
  }

  async remove(academyId: string, id: string, req: AuthenticatedRequest) {
    const before = await this.prisma.event.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Event not found');
    await this.prisma.event.delete({ where: { id } });
    await this.audit.fromRequest(req, 'DELETE', 'Event', id, { before });
    return { deleted: true };
  }

  async publish(academyId: string, id: string, req: AuthenticatedRequest) {
    const before = await this.prisma.event.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Event not found');
    const after = await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.PUBLISHED },
    });
    await this.audit.fromRequest(req, 'UPDATE', 'Event', id, { before, after });
    return after;
  }

  // ── Registrations ────────────────────────────────────────────────────────
  async register(academyId: string, eventId: string, studentId: string, actor: AuthenticatedUser, req: AuthenticatedRequest) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, academyId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.LIVE) {
      throw new BadRequestException('Event is not open for registration');
    }
    const now = new Date();
    if (event.registrationStartAt && now < event.registrationStartAt) {
      throw new BadRequestException('Registration has not started yet');
    }
    if (event.registrationEndAt && now > event.registrationEndAt) {
      throw new BadRequestException('Registration has closed');
    }
    if (event.capacity) {
      const count = await this.prisma.eventRegistration.count({ where: { eventId } });
      if (count >= event.capacity) throw new BadRequestException('Event is at capacity');
    }
    await this.assertStudentAccess(academyId, actor, studentId);

    try {
      const registration = await this.prisma.eventRegistration.create({
        data: {
          eventId,
          studentId,
          status: event.requiresApproval ? 'PENDING' : 'REGISTERED',
        },
      });
      await this.audit.fromRequest(req, 'CREATE', 'EventRegistration', registration.id, { after: registration });
      return registration;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Student is already registered for this event');
      }
      throw err;
    }
  }

  async listRegistrations(academyId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, academyId }, select: { id: true } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.eventRegistration.findMany({
      where: { eventId },
      include: {
        student: { select: { id: true, studentCode: true, firstName: true, lastName: true, currentBelt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async cancelRegistration(academyId: string, eventId: string, registrationId: string, actor: AuthenticatedUser, req: AuthenticatedRequest) {
    const registration = await this.prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId, event: { academyId } },
      include: { student: { select: { userId: true } } },
    });
    if (!registration) throw new NotFoundException('Registration not found');
    if (actor.role === UserRole.STUDENT && registration.student.userId !== actor.id) {
      throw new ForbiddenException('You may only cancel your own registration');
    }
    const after = await this.prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { status: 'CANCELLED' },
    });
    await this.audit.fromRequest(req, 'UPDATE', 'EventRegistration', registrationId, {
      before: registration,
      after,
    });
    return after;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private async uniqueSlug(academyId: string, title: string): Promise<string> {
    const base = slugify(title).slice(0, 80) || 'event';
    let candidate = base;
    for (let i = 2; i < 50; i++) {
      const clash = await this.prisma.event.findFirst({
        where: { academyId, slug: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
      candidate = `${base}-${i}`;
    }
    return `${base}-${Date.now()}`;
  }

  private async assertStudentAccess(academyId: string, actor: AuthenticatedUser, studentId: string): Promise<void> {
    if ([UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.INSTRUCTOR, UserRole.RECEPTIONIST].includes(actor.role)) return;
    if (actor.role === UserRole.STUDENT) {
      const me = await this.prisma.student.findFirst({ where: { userId: actor.id, academyId } });
      if (me?.id !== studentId) throw new ForbiddenException('You may only register yourself for events');
      return;
    }
    if (actor.role === UserRole.PARENT) {
      const link = await this.prisma.parentStudent.findFirst({
        where: { studentId, parent: { userId: actor.id, academyId } },
      });
      if (!link) throw new ForbiddenException('You may only register your children for events');
    }
  }
}

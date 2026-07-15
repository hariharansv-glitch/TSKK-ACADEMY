import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';

interface CreateSessionInput {
  userId: string;
  academyId: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
  device?: string | null;
  location?: string | null;
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateSessionInput) {
    return this.prisma.session.create({
      data: {
        userId: input.userId,
        academyId: input.academyId,
        userAgent: input.userAgent ?? undefined,
        ipAddress: input.ipAddress ?? undefined,
        device: input.device ?? undefined,
        location: input.location ?? undefined,
        expiresAt: input.expiresAt,
      },
    });
  }

  touch(sessionId: string) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() },
    });
  }

  revoke(sessionId: string) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllForUser(userId: string, exceptSessionId?: string) {
    return this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  listActive(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: 'desc' },
    });
  }
}

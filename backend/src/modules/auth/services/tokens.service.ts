import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { UserRole } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { randomToken, sha256 } from '@common/utils/hash.util';
import type { EnvVars } from '@config/env.validation';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  academyId: string | null;
  sid: string;
  iat?: number;
  exp?: number;
}

interface IssueOpts {
  userId: string;
  email: string;
  role: UserRole;
  academyId: string | null;
  sessionId: string;
  familyId?: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  familyId: string;
  refreshTokenId: string;
}

/**
 * Handles issuance, verification and rotation of JWT + refresh tokens.
 *
 * Refresh-token rotation with reuse detection:
 *   - Each refresh token belongs to a `familyId`.
 *   - Presenting a token whose DB row has already been rotated (i.e. `replacedBy`
 *     is set) is treated as reuse: the entire family is revoked and the user is
 *     forced to log in again.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvVars, true>,
    private readonly prisma: PrismaService,
  ) {}

  async issue(opts: IssueOpts): Promise<TokenPair> {
    const accessSecret = this.config.get('JWT_ACCESS_SECRET', { infer: true });
    const accessTtl = this.config.get('JWT_ACCESS_TTL', { infer: true });
    const refreshTtl = this.config.get('JWT_REFRESH_TTL', { infer: true });

    const familyId = opts.familyId ?? randomUUID();
    const rawRefresh = randomToken(48);
    const refreshExpires = new Date(Date.now() + this.parseDurationMs(refreshTtl));

    const record = await this.prisma.refreshToken.create({
      data: {
        userId: opts.userId,
        academyId: opts.academyId,
        tokenHash: sha256(rawRefresh),
        familyId,
        userAgent: opts.userAgent ?? undefined,
        ipAddress: opts.ipAddress ?? undefined,
        expiresAt: refreshExpires,
      },
    });

    const payload: AccessTokenPayload = {
      sub: opts.userId,
      email: opts.email,
      role: opts.role,
      academyId: opts.academyId,
      sid: opts.sessionId,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessTtl,
    });
    const decoded = this.jwt.decode(accessToken) as { exp?: number } | null;
    const accessTokenExpiresAt = decoded?.exp ?? Math.floor(Date.now() / 1000) + 900;

    return {
      accessToken,
      refreshToken: rawRefresh,
      accessTokenExpiresAt,
      refreshTokenExpiresAt: Math.floor(refreshExpires.getTime() / 1000),
      familyId,
      refreshTokenId: record.id,
    };
  }

  async rotate(rawRefreshToken: string, ua: string | null, ip: string | null): Promise<TokenPair> {
    const tokenHash = sha256(rawRefreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }
    if (record.revokedAt) {
      await this.revokeFamily(record.familyId, 'Refresh-token reuse detected');
      throw new UnauthorizedException('Refresh token reuse detected — all sessions revoked');
    }
    if (record.replacedBy) {
      await this.revokeFamily(record.familyId, 'Refresh-token reuse detected');
      throw new UnauthorizedException('Refresh token reuse detected — all sessions revoked');
    }

    const nextRaw = randomToken(48);
    const refreshTtl = this.config.get('JWT_REFRESH_TTL', { infer: true });
    const nextExpires = new Date(Date.now() + this.parseDurationMs(refreshTtl));

    const nextRecord = await this.prisma.$transaction(async (tx) => {
      const next = await tx.refreshToken.create({
        data: {
          userId: record.userId,
          academyId: record.academyId,
          tokenHash: sha256(nextRaw),
          familyId: record.familyId,
          userAgent: ua ?? undefined,
          ipAddress: ip ?? undefined,
          expiresAt: nextExpires,
        },
      });
      await tx.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date(), replacedBy: next.id },
      });
      return next;
    });

    const payload: AccessTokenPayload = {
      sub: record.user.id,
      email: record.user.email,
      role: record.user.role,
      academyId: record.user.academyId,
      sid: record.familyId,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
    });
    const decoded = this.jwt.decode(accessToken) as { exp?: number } | null;

    return {
      accessToken,
      refreshToken: nextRaw,
      accessTokenExpiresAt: decoded?.exp ?? Math.floor(Date.now() / 1000) + 900,
      refreshTokenExpiresAt: Math.floor(nextExpires.getTime() / 1000),
      familyId: record.familyId,
      refreshTokenId: nextRecord.id,
    };
  }

  async revokeByRawToken(rawRefreshToken: string): Promise<void> {
    const tokenHash = sha256(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string, _reason: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Parse a duration string like `15m`, `30d`, `12h`, `900s` into milliseconds.
   * Falls back to the numeric value interpreted as seconds if a unit is missing.
   */
  private parseDurationMs(input: string): number {
    const m = /^(\d+)\s*([smhd])?$/i.exec(input.trim());
    if (!m) return 15 * 60 * 1000;
    const value = Number(m[1]);
    switch ((m[2] ?? 's').toLowerCase()) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return value * 1000;
    }
  }
}

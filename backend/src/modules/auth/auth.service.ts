import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import type { EnvVars } from '@config/env.validation';
import { PrismaService } from '@database/prisma.service';
import { MailerService } from '@modules/mailer/mailer.service';
import { hashPassword, verifyPassword } from '@common/utils/password.util';
import { randomToken, sha256 } from '@common/utils/hash.util';
import type { AuthenticatedUser } from '@common/types/authenticated-request';

import type { RegisterInput } from './dto/register.dto';
import type { LoginInput } from './dto/login.dto';
import type { ForgotPasswordInput } from './dto/forgot-password.dto';
import type { ResetPasswordInput } from './dto/reset-password.dto';
import type { VerifyEmailInput } from './dto/verify-email.dto';
import type { ChangePasswordInput } from './dto/change-password.dto';
import { LOCK_DURATION_MINUTES, MAX_LOGIN_ATTEMPTS } from './dto/password.constants';
import { PermissionsService } from './services/permissions.service';
import { SessionsService } from './services/sessions.service';
import { TokensService } from './services/tokens.service';

interface AuthContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface AuthResult {
  user: AuthenticatedUser & {
    firstName: string;
    lastName: string;
    status: UserStatus;
    avatarUrl: string | null;
    emailVerified: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: number;
    refreshTokenExpiresAt: number;
  };
}

const VERIFY_TOKEN_TTL_HOURS = 24;
const RESET_TOKEN_TTL_MINUTES = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly tokens: TokensService,
    private readonly sessions: SessionsService,
    private readonly permissions: PermissionsService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  // ── Register ─────────────────────────────────────────────────────────────
  async register(input: RegisterInput, ctx: AuthContext): Promise<{ userId: string; status: UserStatus }> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    let academyId: string | null = null;
    let academyName = 'TSKK Academy';
    if (input.academySlug) {
      const academy = await this.prisma.academy.findUnique({
        where: { slug: input.academySlug },
        select: { id: true, name: true, status: true, deletedAt: true },
      });
      if (!academy || academy.deletedAt) throw new NotFoundException('Academy not found');
      if (academy.status === 'SUSPENDED' || academy.status === 'CANCELLED') {
        throw new ForbiddenException('This academy is not accepting new registrations');
      }
      academyId = academy.id;
      academyName = academy.name;
    } else if (input.role !== UserRole.SUPER_ADMIN) {
      throw new BadRequestException('academySlug is required for non-super-admin registrations');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: `${input.firstName} ${input.lastName}`,
        role: input.role,
        academyId,
        status: UserStatus.PENDING_VERIFICATION,
      },
      select: { id: true, email: true, firstName: true, status: true },
    });

    await this.issueVerificationEmail(user.id, user.email, user.firstName, academyName, ctx);

    this.logger.log(`Registered user ${user.email} (${input.role})`);
    return { userId: user.id, status: user.status };
  }

  // ── Email verification ───────────────────────────────────────────────────
  async issueVerificationEmail(
    userId: string,
    email: string,
    firstName: string,
    academyName: string,
    _ctx: AuthContext,
  ): Promise<void> {
    const raw = randomToken(32);
    const tokenHash = sha256(raw);
    const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000);

    await this.prisma.emailVerification.create({
      data: { userId, tokenHash, expiresAt },
    });

    const verifyUrl = `${this.config.get('APP_URL', { infer: true })}/auth/verify?token=${raw}`;
    await this.mailer.sendTemplate(email, 'verify-email', {
      firstName,
      academyName,
      verifyUrl,
      expiresInHours: VERIFY_TOKEN_TTL_HOURS,
    });
  }

  async resendVerification(email: string, ctx: AuthContext): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, emailVerified: true, academy: { select: { name: true } } },
    });
    if (!user) return;
    if (user.emailVerified) return;
    await this.issueVerificationEmail(user.id, user.email, user.firstName, user.academy?.name ?? 'TSKK Academy', ctx);
  }

  async verifyEmail(input: VerifyEmailInput): Promise<void> {
    const tokenHash = sha256(input.token);
    const record = await this.prisma.emailVerification.findUnique({
      where: { tokenHash },
      include: { user: { include: { academy: true } } },
    });
    if (!record) throw new BadRequestException('Invalid or expired verification token');
    if (record.usedAt) throw new BadRequestException('This verification link has already been used');
    if (record.expiresAt.getTime() < Date.now()) throw new BadRequestException('Verification link expired');

    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          status: UserStatus.ACTIVE,
        },
      }),
    ]);

    await this.mailer
      .sendTemplate(record.user.email, 'welcome', {
        firstName: record.user.firstName,
        role: record.user.role,
        academyName: record.user.academy?.name ?? 'TSKK Academy',
        loginUrl: `${this.config.get('APP_URL', { infer: true })}/auth/login`,
      })
      .catch((err) => this.logger.warn(`Welcome mail failed: ${(err as Error).message}`));
  }

  // ── Local-strategy credential validation ─────────────────────────────────
  async validateCredentials(email: string, password: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) return null;

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException(
        `Account temporarily locked. Try again after ${user.lockedUntil.toISOString()}`,
      );
    }

    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) {
      await this.recordFailedLogin(user.id, user.failedLoginCount);
      return null;
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new UnauthorizedException('Please verify your email address before logging in');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(`Account is ${user.status}`);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    const permissions = await this.permissions.getForRole(user.role);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      academyId: user.academyId,
      permissions,
    };
  }

  private async recordFailedLogin(userId: string, currentCount: number): Promise<void> {
    const nextCount = currentCount + 1;
    const shouldLock = nextCount >= MAX_LOGIN_ATTEMPTS;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: nextCount,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60_000) : undefined,
      },
    });
  }

  // ── Login ────────────────────────────────────────────────────────────────
  async login(input: LoginInput, ctx: AuthContext): Promise<AuthResult> {
    const user = await this.validateCredentials(input.email, input.password);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    return this.buildAuthResult(user.id, ctx);
  }

  async buildAuthResult(userId: string, ctx: AuthContext): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        academyId: true, status: true, avatarUrl: true, emailVerified: true,
      },
    });
    if (!user) throw new UnauthorizedException('Account not found');

    const refreshTtl = this.config.get('JWT_REFRESH_TTL', { infer: true });
    const session = await this.sessions.create({
      userId: user.id,
      academyId: user.academyId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      expiresAt: new Date(Date.now() + this.parseDurationMs(refreshTtl)),
    });

    const tokens = await this.tokens.issue({
      userId: user.id,
      email: user.email,
      role: user.role,
      academyId: user.academyId,
      sessionId: session.id,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ctx.ipAddress ?? undefined },
    });

    const permissions = await this.permissions.getForRole(user.role);
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        academyId: user.academyId,
        status: user.status,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        sessionId: session.id,
        permissions,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      },
    };
  }

  // ── Refresh ──────────────────────────────────────────────────────────────
  async refresh(rawRefreshToken: string, ctx: AuthContext) {
    const pair = await this.tokens.rotate(rawRefreshToken, ctx.userAgent ?? null, ctx.ipAddress ?? null);
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      accessTokenExpiresAt: pair.accessTokenExpiresAt,
      refreshTokenExpiresAt: pair.refreshTokenExpiresAt,
    };
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  async logout(userId: string, sessionId: string | undefined, rawRefreshToken?: string): Promise<void> {
    if (rawRefreshToken) await this.tokens.revokeByRawToken(rawRefreshToken);
    if (sessionId) await this.sessions.revoke(sessionId);
    this.logger.log(`User ${userId} logged out (session ${sessionId ?? 'n/a'})`);
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
    await this.sessions.revokeAllForUser(userId);
  }

  // ── Forgot & reset ───────────────────────────────────────────────────────
  async forgotPassword(input: ForgotPasswordInput, ctx: AuthContext): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, firstName: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      // Do not disclose whether the account exists.
      return;
    }

    const raw = randomToken(32);
    const tokenHash = sha256(raw);
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
        requestIp: ctx.ipAddress ?? undefined,
      },
    });

    const resetUrl = `${this.config.get('APP_URL', { infer: true })}/auth/reset-password?token=${raw}`;
    await this.mailer.sendTemplate(user.email, 'reset-password', {
      firstName: user.firstName,
      email: user.email,
      resetUrl,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      requestIp: ctx.ipAddress,
    });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokenHash = sha256(input.token);
    const record = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record) throw new BadRequestException('Invalid or expired reset token');
    if (record.usedAt) throw new BadRequestException('This reset link has already been used');
    if (record.expiresAt.getTime() < Date.now()) throw new BadRequestException('Reset link expired');

    const passwordHash = await hashPassword(input.newPassword);
    await this.prisma.$transaction([
      this.prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      }),
    ]);
    await this.logoutAllDevices(record.userId);

    await this.mailer
      .sendTemplate(record.user.email, 'password-changed', {
        firstName: record.user.firstName,
        email: record.user.email,
        changedAt: new Date().toUTCString(),
      })
      .catch(() => undefined);
  }

  // ── Change password (authenticated) ──────────────────────────────────────
  async changePassword(userId: string, input: ChangePasswordInput, ctx: AuthContext): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    const ok = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await hashPassword(input.newPassword);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.logoutAllDevices(user.id);

    await this.mailer
      .sendTemplate(user.email, 'password-changed', {
        firstName: user.firstName,
        email: user.email,
        changedAt: new Date().toUTCString(),
      })
      .catch(() => undefined);

    this.logger.log(`Password changed for user ${user.email} from ${ctx.ipAddress ?? 'unknown ip'}`);
  }

  // ── Me / profile ─────────────────────────────────────────────────────────
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, displayName: true,
        role: true, status: true, academyId: true, avatarUrl: true,
        emailVerified: true, phone: true, phoneVerified: true, locale: true,
        lastLoginAt: true, createdAt: true,
        academy: { select: { id: true, slug: true, name: true, discipline: true, primaryColor: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const permissions = await this.permissions.getForRole(user.role);
    return { ...user, permissions };
  }

  private parseDurationMs(input: string): number {
    const m = /^(\d+)\s*([smhd])?$/i.exec(input.trim());
    if (!m) return 30 * 24 * 60 * 60 * 1000;
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

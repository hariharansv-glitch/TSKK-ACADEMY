import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { PermissionsService } from '../services/permissions.service';
import type { AccessTokenPayload } from '../services/tokens.service';
import type { AuthenticatedUser } from '@common/types/authenticated-request';
import type { EnvVars } from '@config/env.validation';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<EnvVars, true>,
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        academyId: true,
        status: true,
        deletedAt: true,
      },
    });
    if (!user || user.deletedAt) throw new UnauthorizedException('Account not found');
    if (user.status !== UserStatus.ACTIVE) throw new UnauthorizedException(`Account status: ${user.status}`);

    const permissions = await this.permissions.getForRole(user.role);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      academyId: user.academyId,
      sessionId: payload.sid,
      permissions,
    };
  }
}

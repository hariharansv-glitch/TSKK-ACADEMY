import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '@common/types/authenticated-request';

import {
  RegisterDto,
  registerSchema,
} from './dto/register.dto';
import { LoginDto, loginSchema } from './dto/login.dto';
import { RefreshDto, refreshSchema } from './dto/refresh.dto';
import { ForgotPasswordDto, forgotPasswordSchema } from './dto/forgot-password.dto';
import { ResetPasswordDto, resetPasswordSchema } from './dto/reset-password.dto';
import {
  ResendVerificationDto,
  resendVerificationSchema,
  VerifyEmailDto,
  verifyEmailSchema,
} from './dto/verify-email.dto';
import { ChangePasswordDto, changePasswordSchema } from './dto/change-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private ctx(req: Request) {
    return {
      ipAddress: (req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip) ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new user (email verification required)' })
  @UsePipes(new ZodValidationPipe(registerSchema))
  register(@Body() body: RegisterDto, @Req() req: Request) {
    return this.auth.register(body, this.ctx(req));
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Password-based login' })
  @ApiOkResponse({ type: AuthResponseDto })
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: LoginDto, @Req() req: Request) {
    return this.auth.login(body, this.ctx(req));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate access & refresh tokens' })
  @UsePipes(new ZodValidationPipe(refreshSchema))
  refresh(@Body() body: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(body.refreshToken, this.ctx(req));
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an email address using a signed token' })
  @UsePipes(new ZodValidationPipe(verifyEmailSchema))
  async verifyEmail(@Body() body: VerifyEmailDto) {
    await this.auth.verifyEmail(body);
    return { verified: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Re-send the email verification link' })
  @UsePipes(new ZodValidationPipe(resendVerificationSchema))
  async resendVerification(@Body() body: ResendVerificationDto, @Req() req: Request) {
    await this.auth.resendVerification(body.email, this.ctx(req));
    return { queued: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Send a password-reset email' })
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  async forgotPassword(@Body() body: ForgotPasswordDto, @Req() req: Request) {
    await this.auth.forgotPassword(body, this.ctx(req));
    return { queued: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a one-time token' })
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.auth.resetPassword(body);
    return { reset: true };
  }

  @ApiBearerAuth('access-token')
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change the currently-authenticated user\'s password' })
  @UsePipes(new ZodValidationPipe(changePasswordSchema))
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChangePasswordDto,
    @Req() req: Request,
  ) {
    await this.auth.changePassword(user.id, body, this.ctx(req));
    return { changed: true };
  }

  @ApiBearerAuth('access-token')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current session and refresh token' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { refreshToken?: string } = {},
  ) {
    await this.auth.logout(user.id, user.sessionId, body?.refreshToken);
    return { loggedOut: true };
  }

  @ApiBearerAuth('access-token')
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke every active session for this user' })
  async logoutAll(@CurrentUser() user: AuthenticatedUser) {
    await this.auth.logoutAllDevices(user.id);
    return { loggedOutAll: true };
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  @ApiOperation({ summary: 'Return the current authenticated user profile' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getProfile(user.id);
  }
}

import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
  @ApiProperty({ enum: UserStatus }) status!: UserStatus;
  @ApiProperty({ nullable: true }) academyId!: string | null;
  @ApiProperty({ type: [String] }) permissions!: string[];
  @ApiProperty({ nullable: true, required: false }) avatarUrl?: string | null;
  @ApiProperty() emailVerified!: boolean;
}

export class TokensDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ description: 'Access token expiry (seconds since epoch)' }) accessTokenExpiresAt!: number;
  @ApiProperty({ description: 'Refresh token expiry (seconds since epoch)' }) refreshTokenExpiresAt!: number;
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
  @ApiProperty({ type: TokensDto }) tokens!: TokensDto;
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { UsersService } from './users.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  CreateUserDto,
  createUserSchema,
  ListUsersQueryDto,
  listUsersSchema,
  SetRoleDto,
  setRoleSchema,
  SetStatusDto,
  setStatusSchema,
  UpdateUserDto,
  updateUserSchema,
} from './dto/user.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';

class UserDtoResponse {}

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  // ── Self-service (any authenticated user) ────────────────────────────────
  @Get('me/sessions')
  @ApiOperation({ summary: 'List active sessions for the current user' })
  mySessions(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listMySessions(user.id);
  }

  @Delete('me/sessions/:id')
  @ApiOperation({ summary: 'Revoke one of my active sessions' })
  revokeMySession(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.revokeMySession(user.id, id);
  }

  // ── Admin surface ────────────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @ApiOperation({ summary: 'Invite a user to the current academy' })
  create(
    @Tenant() academyId: string | null,
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(academyId, body, actor, req);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'List users' })
  @ApiPaginatedResponse(UserDtoResponse)
  list(
    @Tenant() academyId: string | null,
    @CurrentUser() actor: AuthenticatedUser,
    @Query(new ZodValidationPipe(listUsersSchema)) query: ListUsersQueryDto,
  ) {
    return this.service.list(academyId, actor, query as never);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  detail(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.findById(id, actor);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user profile' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(id, body, actor, req);
  }

  @Post(':id/role')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @ApiOperation({ summary: 'Change a user role' })
  setRole(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setRoleSchema)) body: SetRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.setRole(id, body, actor, req);
  }

  @Post(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @ApiOperation({ summary: 'Change a user status (activate/suspend/deactivate)' })
  setStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setStatusSchema)) body: SetStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.setStatus(id, body, actor, req);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @ApiOperation({ summary: 'Soft-delete a user' })
  remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser, @Req() req: AuthenticatedRequest) {
    return this.service.remove(id, actor, req);
  }
}

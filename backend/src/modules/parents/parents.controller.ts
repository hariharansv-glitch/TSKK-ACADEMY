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

import { ParentsService } from './parents.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  CreateParentDto,
  createParentSchema,
  LinkChildDto,
  linkChildSchema,
  ListParentsQueryDto,
  listParentsSchema,
  UpdateParentDto,
  updateParentSchema,
} from './dto/parent.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';

class ParentDtoResponse {}

@ApiTags('parents')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard)
@Controller('parents')
export class ParentsController {
  constructor(private readonly service: ParentsService) {}

  // ── Parent self-service ──────────────────────────────────────────────────
  @Get('me')
  @Roles(UserRole.PARENT, UserRole.ACADEMY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get the current parent profile' })
  me(@Tenant({ required: true }) academyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findMineByUser(academyId, user.id);
  }

  @Get('me/children')
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Attendance / fee / certificate summary for my children' })
  myChildren(@Tenant({ required: true }) academyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.myChildrenSummary(academyId, user.id);
  }

  // ── Admin surface ────────────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST)
  @Permissions('parent.manage')
  @ApiOperation({ summary: 'Create a parent record' })
  create(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createParentSchema)) body: CreateParentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(academyId, body as never, req);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT, UserRole.INSTRUCTOR)
  @Permissions('parent.manage')
  @ApiOperation({ summary: 'List parents' })
  @ApiPaginatedResponse(ParentDtoResponse)
  list(
    @Tenant({ required: true }) academyId: string,
    @Query(new ZodValidationPipe(listParentsSchema)) query: ListParentsQueryDto,
  ) {
    return this.service.list(academyId, query as never);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a parent by id' })
  detail(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findById(academyId, id, user);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST)
  @Permissions('parent.manage')
  @ApiOperation({ summary: 'Update a parent record' })
  update(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateParentSchema)) body: UpdateParentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(academyId, id, body as never, user, req);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('parent.manage')
  @ApiOperation({ summary: 'Soft-delete a parent record' })
  remove(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.remove(academyId, id, req);
  }

  @Post(':id/children')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST)
  @Permissions('parent.manage')
  @ApiOperation({ summary: 'Link a student to this parent' })
  linkChild(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(linkChildSchema)) body: LinkChildDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.linkChild(academyId, id, body as never, req);
  }

  @Delete(':id/children/:studentId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST)
  @Permissions('parent.manage')
  @ApiOperation({ summary: 'Unlink a student from this parent' })
  unlinkChild(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.unlinkChild(academyId, id, studentId, req);
  }
}

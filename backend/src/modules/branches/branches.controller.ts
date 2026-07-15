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

import { BranchesService } from './branches.service';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import {
  CreateBranchDto,
  createBranchSchema,
  ListBranchesQueryDto,
  listBranchesSchema,
  UpdateBranchDto,
  updateBranchSchema,
} from './dto/branch.dto';
import type { AuthenticatedRequest } from '@common/types/authenticated-request';

class BranchDtoResponse {}

@ApiTags('branches')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @ApiOperation({ summary: 'Create a branch' })
  create(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createBranchSchema)) body: CreateBranchDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(academyId, body, req);
  }

  @Get()
  @ApiOperation({ summary: 'List branches for the current academy' })
  @ApiPaginatedResponse(BranchDtoResponse)
  list(
    @Tenant({ required: true }) academyId: string,
    @Query(new ZodValidationPipe(listBranchesSchema)) query: ListBranchesQueryDto,
  ) {
    return this.service.list(academyId, query as never);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a branch by id' })
  detail(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
  ) {
    return this.service.findById(academyId, id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @ApiOperation({ summary: 'Update a branch' })
  update(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBranchSchema)) body: UpdateBranchDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(academyId, id, body, req);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @ApiOperation({ summary: 'Soft-delete a branch (cannot be primary)' })
  remove(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.remove(academyId, id, req);
  }
}

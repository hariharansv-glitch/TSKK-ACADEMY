import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { InventoryService } from './inventory.service';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  AdjustStockDto,
  adjustStockSchema,
  CreateItemDto,
  createItemSchema,
  CreateOrderDto,
  createOrderSchema,
  ListItemsQueryDto,
  listItemsSchema,
  ListOrdersQueryDto,
  listOrdersSchema,
  UpdateItemDto,
  updateItemSchema,
  UpdateOrderStatusDto,
  updateOrderStatusSchema,
} from './dto/inventory.dto';
import type { AuthenticatedRequest } from '@common/types/authenticated-request';

class InventoryRow {}

@ApiTags('inventory')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  // ── Items ─────────────────────────────────────────────────────────────────
  @Post('items')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST)
  @Permissions('inventory.create')
  @ApiOperation({ summary: 'Add an inventory item' })
  createItem(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createItemSchema)) body: CreateItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createItem(academyId, body as never, req);
  }

  @Get('items')
  @Permissions('inventory.view')
  @ApiPaginatedResponse(InventoryRow)
  listItems(
    @Tenant({ required: true }) academyId: string,
    @Query(new ZodValidationPipe(listItemsSchema)) query: ListItemsQueryDto,
  ) {
    return this.service.listItems(academyId, query as never);
  }

  @Get('items/:id')
  @Permissions('inventory.view')
  findItem(@Tenant({ required: true }) academyId: string, @Param('id') id: string) {
    return this.service.findItem(academyId, id);
  }

  @Patch('items/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST)
  @Permissions('inventory.update')
  updateItem(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateItemSchema)) body: UpdateItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateItem(academyId, id, body as never, req);
  }

  @Delete('items/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('inventory.delete')
  removeItem(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.removeItem(academyId, id, req);
  }

  @Post('items/:id/adjust-stock')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST)
  @Permissions('inventory.update')
  adjustStock(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adjustStockSchema)) body: AdjustStockDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.adjustStock(academyId, id, body as never, req);
  }

  // ── Orders ────────────────────────────────────────────────────────────────
  @Post('orders')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT)
  @Permissions('inventory.create')
  createOrder(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createOrder(academyId, body as never, req);
  }

  @Get('orders')
  @Permissions('inventory.view')
  @ApiPaginatedResponse(InventoryRow)
  listOrders(
    @Tenant({ required: true }) academyId: string,
    @Query(new ZodValidationPipe(listOrdersSchema)) query: ListOrdersQueryDto,
  ) {
    return this.service.listOrders(academyId, query as never);
  }

  @Get('orders/:id')
  @Permissions('inventory.view')
  findOrder(@Tenant({ required: true }) academyId: string, @Param('id') id: string) {
    return this.service.findOrder(academyId, id);
  }

  @Patch('orders/:id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT)
  @Permissions('inventory.update')
  updateOrderStatus(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateOrderStatusSchema)) body: UpdateOrderStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateOrderStatus(academyId, id, body as never, req);
  }
}

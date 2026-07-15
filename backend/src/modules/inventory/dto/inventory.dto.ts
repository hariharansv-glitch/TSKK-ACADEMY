import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryCategory, OrderStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '@common/dto/pagination.dto';

export const createItemSchema = z.object({
  sku: z.string().trim().min(1).max(40).regex(/^[A-Z0-9-]+$/i, 'SKU must be alphanumeric with dashes'),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  category: z.nativeEnum(InventoryCategory),
  size: z.string().trim().max(40).optional(),
  color: z.string().trim().max(40).optional(),
  pricePaise: z.coerce.number().int().min(0),
  costPaise: z.coerce.number().int().min(0).default(0),
  stockQty: z.coerce.number().int().min(0).default(0),
  reorderLevel: z.coerce.number().int().min(0).default(5),
  imageUrl: z.string().url().optional(),
  isActive: z.coerce.boolean().optional().default(true),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;
export class CreateItemDto {
  @ApiProperty() sku!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty({ enum: InventoryCategory }) category!: InventoryCategory;
  @ApiPropertyOptional() size?: string;
  @ApiPropertyOptional() color?: string;
  @ApiProperty() pricePaise!: number;
  @ApiPropertyOptional({ default: 0 }) costPaise?: number = 0;
  @ApiPropertyOptional({ default: 0 }) stockQty?: number = 0;
  @ApiPropertyOptional({ default: 5 }) reorderLevel?: number = 5;
  @ApiPropertyOptional() imageUrl?: string;
  @ApiPropertyOptional({ default: true }) isActive?: boolean = true;
}

export const updateItemSchema = createItemSchema.partial();
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export class UpdateItemDto extends CreateItemDto {}

export const adjustStockSchema = z.object({
  delta: z.coerce.number().int(),
  reason: z.string().trim().max(200).optional(),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export class AdjustStockDto {
  @ApiProperty() delta!: number;
  @ApiPropertyOptional() reason?: string;
}

export const listItemsSchema = paginationQuerySchema.extend({
  category: z.nativeEnum(InventoryCategory).optional(),
  lowStock: z.coerce.boolean().optional(),
  activeOnly: z.coerce.boolean().optional().default(true),
});
export type ListItemsQuery = z.infer<typeof listItemsSchema>;
export class ListItemsQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional({ enum: InventoryCategory }) category?: InventoryCategory;
  @ApiPropertyOptional() lowStock?: boolean;
  @ApiPropertyOptional({ default: true }) activeOnly?: boolean;
}

export const createOrderSchema = z.object({
  studentId: z.string().trim().min(1).max(48).optional(),
  items: z.array(z.object({
    itemId: z.string().trim().min(1).max(48),
    quantity: z.coerce.number().int().min(1).max(1000),
  })).min(1).max(50),
  taxPaise: z.coerce.number().int().min(0).optional().default(0),
  notes: z.string().trim().max(1000).optional(),
  shippingAddress: z.record(z.unknown()).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export class CreateOrderDto {
  @ApiPropertyOptional() studentId?: string;
  @ApiProperty({ type: [Object] }) items!: Array<{ itemId: string; quantity: number }>;
  @ApiPropertyOptional({ default: 0 }) taxPaise?: number = 0;
  @ApiPropertyOptional() notes?: string;
  @ApiPropertyOptional() shippingAddress?: Record<string, unknown>;
}

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  notes: z.string().trim().max(1000).optional(),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus }) status!: OrderStatus;
  @ApiPropertyOptional() notes?: string;
}

export const listOrdersSchema = paginationQuerySchema.extend({
  status: z.nativeEnum(OrderStatus).optional(),
  studentId: z.string().trim().min(1).max(48).optional(),
});
export type ListOrdersQuery = z.infer<typeof listOrdersSchema>;
export class ListOrdersQueryDto {
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() pageSize?: number;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDir?: 'asc' | 'desc';
  @ApiPropertyOptional({ enum: OrderStatus }) status?: OrderStatus;
  @ApiPropertyOptional() studentId?: string;
}

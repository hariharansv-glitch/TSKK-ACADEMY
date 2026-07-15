import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { AuditLogService } from '@common/services/audit-log.service';
import { paginate } from '@common/dto/paginated-response.dto';
import { formatEntityCode } from '@common/utils/ids.util';
import type { AuthenticatedRequest } from '@common/types/authenticated-request';
import type {
  AdjustStockInput,
  CreateItemInput,
  CreateOrderInput,
  ListItemsQuery,
  ListOrdersQuery,
  UpdateItemInput,
  UpdateOrderStatusInput,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // ── Items ─────────────────────────────────────────────────────────────────
  async createItem(academyId: string, input: CreateItemInput, req: AuthenticatedRequest) {
    try {
      const item = await this.prisma.inventoryItem.create({
        data: { academyId, ...input, sku: input.sku.toUpperCase() },
      });
      await this.audit.fromRequest(req, 'CREATE', 'InventoryItem', item.id, { after: item });
      return item;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`SKU "${input.sku}" already exists in this academy`);
      }
      throw err;
    }
  }

  async listItems(academyId: string, query: ListItemsQuery) {
    const where: Prisma.InventoryItemWhereInput = {
      academyId,
      ...(query.activeOnly ? { isActive: true } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? {
            OR: [
              { sku: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    let rows = await this.prisma.inventoryItem.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    if (query.lowStock) rows = rows.filter((r) => r.stockQty <= r.reorderLevel);
    const total = await this.prisma.inventoryItem.count({ where });
    return paginate(rows, query.page, query.pageSize, total);
  }

  async findItem(academyId: string, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, academyId } });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async updateItem(academyId: string, id: string, input: UpdateItemInput, req: AuthenticatedRequest) {
    const before = await this.prisma.inventoryItem.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Item not found');
    const after = await this.prisma.inventoryItem.update({
      where: { id },
      data: { ...input, sku: input.sku ? input.sku.toUpperCase() : undefined },
    });
    await this.audit.fromRequest(req, 'UPDATE', 'InventoryItem', id, { before, after });
    return after;
  }

  async removeItem(academyId: string, id: string, req: AuthenticatedRequest) {
    const before = await this.prisma.inventoryItem.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Item not found');
    const after = await this.prisma.inventoryItem.update({ where: { id }, data: { isActive: false } });
    await this.audit.fromRequest(req, 'UPDATE', 'InventoryItem', id, { before, after });
    return { deactivated: true };
  }

  async adjustStock(academyId: string, id: string, input: AdjustStockInput, req: AuthenticatedRequest) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, academyId } });
    if (!item) throw new NotFoundException('Item not found');
    const nextQty = item.stockQty + input.delta;
    if (nextQty < 0) throw new BadRequestException('Adjustment would produce negative stock');
    const after = await this.prisma.inventoryItem.update({
      where: { id },
      data: { stockQty: nextQty },
    });
    await this.audit.fromRequest(req, 'UPDATE', 'InventoryItem', id, {
      before: { stockQty: item.stockQty },
      after: { stockQty: nextQty, reason: input.reason },
    });
    return after;
  }

  // ── Orders ────────────────────────────────────────────────────────────────
  async createOrder(academyId: string, input: CreateOrderInput, req: AuthenticatedRequest) {
    return this.prisma.$transaction(async (tx) => {
      const items = await tx.inventoryItem.findMany({
        where: { id: { in: input.items.map((i) => i.itemId) }, academyId, isActive: true },
      });
      if (items.length !== input.items.length) {
        throw new BadRequestException('One or more items are invalid or inactive');
      }
      const map = new Map(items.map((i) => [i.id, i]));
      let subtotal = 0;
      const lineItems: Array<{ itemId: string; quantity: number; unitPricePaise: number; totalPaise: number }> = [];
      for (const line of input.items) {
        const item = map.get(line.itemId)!;
        if (item.stockQty < line.quantity) {
          throw new BadRequestException(`Insufficient stock for "${item.name}" (available ${item.stockQty})`);
        }
        const totalPaise = item.pricePaise * line.quantity;
        subtotal += totalPaise;
        lineItems.push({
          itemId: item.id,
          quantity: line.quantity,
          unitPricePaise: item.pricePaise,
          totalPaise,
        });
      }
      const taxPaise = input.taxPaise ?? 0;
      const total = subtotal + taxPaise;

      const count = await tx.inventoryOrder.count({ where: { academyId } });
      const orderNumber = formatEntityCode('ORD', count + 1, 6);

      const order = await tx.inventoryOrder.create({
        data: {
          academyId,
          studentId: input.studentId,
          orderNumber,
          status: OrderStatus.PENDING,
          subtotalPaise: subtotal,
          taxPaise,
          totalPaise: total,
          notes: input.notes,
          shippingAddress: input.shippingAddress as Prisma.InputJsonValue | undefined,
          items: { create: lineItems },
        },
        include: { items: true },
      });

      for (const line of lineItems) {
        await tx.inventoryItem.update({
          where: { id: line.itemId },
          data: { stockQty: { decrement: line.quantity } },
        });
      }

      await this.audit.fromRequest(req, 'CREATE', 'InventoryOrder', order.id, { after: order });
      return order;
    });
  }

  async listOrders(academyId: string, query: ListOrdersQuery) {
    const where: Prisma.InventoryOrderWhereInput = {
      academyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.search
        ? { orderNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.inventoryOrder.count({ where }),
      this.prisma.inventoryOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async findOrder(academyId: string, id: string) {
    const order = await this.prisma.inventoryOrder.findFirst({
      where: { id, academyId },
      include: {
        student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
        items: { include: { item: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateOrderStatus(academyId: string, id: string, input: UpdateOrderStatusInput, req: AuthenticatedRequest) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.inventoryOrder.findFirst({
        where: { id, academyId },
        include: { items: true },
      });
      if (!before) throw new NotFoundException('Order not found');

      if (input.status === OrderStatus.CANCELLED && before.status !== OrderStatus.CANCELLED) {
        for (const line of before.items) {
          await tx.inventoryItem.update({
            where: { id: line.itemId },
            data: { stockQty: { increment: line.quantity } },
          });
        }
      }

      const after = await tx.inventoryOrder.update({
        where: { id },
        data: {
          status: input.status,
          notes: input.notes ? `${before.notes ? before.notes + '\n' : ''}${input.notes}` : before.notes,
        },
      });
      await this.audit.fromRequest(req, 'UPDATE', 'InventoryOrder', id, { before, after });
      return after;
    });
  }
}

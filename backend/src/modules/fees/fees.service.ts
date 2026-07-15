import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FeeStatus, Prisma, PaymentMethod, PaymentStatus, UserRole } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { AuditLogService } from '@common/services/audit-log.service';
import { PdfService } from '@common/pdf/pdf.service';
import { StorageService } from '@common/storage/storage.service';
import { paginate } from '@common/dto/paginated-response.dto';
import { formatEntityCode } from '@common/utils/ids.util';
import { computeInvoiceTotal, formatINR } from '@common/utils/money.util';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';
import type {
  CreateFeePlanInput,
  CreateInvoiceInput,
  ListInvoicesQuery,
  UpdateFeePlanInput,
  UpdateInvoiceInput,
} from './dto/fee.dto';
import type { ListPaymentsQuery, RecordPaymentInput, RefundPaymentInput } from './dto/payment.dto';
import { RazorpayService } from './razorpay.service';
import * as path from 'path';

@Injectable()
export class FeesService {
  private readonly logger = new Logger(FeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
    private readonly razorpay: RazorpayService,
  ) {}

  // ── Fee plans ─────────────────────────────────────────────────────────────
  async listPlans(academyId: string) {
    return this.prisma.feePlan.findMany({
      where: { academyId },
      orderBy: [{ isActive: 'desc' }, { billingCycleMonths: 'asc' }, { amountPaise: 'asc' }],
    });
  }

  async createPlan(academyId: string, input: CreateFeePlanInput, req: AuthenticatedRequest) {
    const plan = await this.prisma.feePlan.create({ data: { academyId, ...input } });
    await this.audit.fromRequest(req, 'CREATE', 'FeePlan', plan.id, { after: plan });
    return plan;
  }

  async updatePlan(academyId: string, id: string, input: UpdateFeePlanInput, req: AuthenticatedRequest) {
    const before = await this.prisma.feePlan.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Fee plan not found');
    const after = await this.prisma.feePlan.update({
      where: { id },
      data: input as Prisma.FeePlanUpdateInput,
    });
    await this.audit.fromRequest(req, 'UPDATE', 'FeePlan', id, { before, after });
    return after;
  }

  async removePlan(academyId: string, id: string, req: AuthenticatedRequest) {
    const before = await this.prisma.feePlan.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Fee plan not found');
    await this.prisma.feePlan.update({ where: { id }, data: { isActive: false } });
    await this.audit.fromRequest(req, 'UPDATE', 'FeePlan', id, { before, after: { isActive: false } });
    return { deactivated: true };
  }

  // ── Invoices ─────────────────────────────────────────────────────────────
  async createInvoice(academyId: string, input: CreateInvoiceInput, req: AuthenticatedRequest) {
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, academyId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    const totalPaise = computeInvoiceTotal({
      amountPaise: input.amountPaise,
      discountPaise: input.discountPaise ?? 0,
      taxPaise: input.taxPaise ?? 0,
    });

    const invoice = await this.prisma.$transaction(async (tx) => {
      const settings = await tx.academySetting.findUnique({ where: { academyId } });
      const prefix = settings?.invoicePrefix ?? 'INV';
      const count = await tx.feeInvoice.count({ where: { academyId } });
      const invoiceNumber = formatEntityCode(prefix, count + 1, 6);

      return tx.feeInvoice.create({
        data: {
          academyId,
          studentId: input.studentId,
          feePlanId: input.feePlanId,
          invoiceNumber,
          type: input.type,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          dueDate: input.dueDate,
          amountPaise: input.amountPaise,
          discountPaise: input.discountPaise ?? 0,
          taxPaise: input.taxPaise ?? 0,
          lateFeePaise: 0,
          totalPaise,
          paidPaise: 0,
          balancePaise: totalPaise,
          scholarshipReason: input.scholarshipReason,
          notes: input.notes,
          status: FeeStatus.PENDING,
          createdById: req.user?.id,
        },
      });
    });

    await this.audit.fromRequest(req, 'CREATE', 'FeeInvoice', invoice.id, { after: invoice });
    return invoice;
  }

  async listInvoices(academyId: string, actor: AuthenticatedUser, query: ListInvoicesQuery) {
    const where: Prisma.FeeInvoiceWhereInput = {
      academyId,
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.overdue
        ? {
            status: { in: [FeeStatus.PENDING, FeeStatus.PARTIAL] },
            dueDate: { lt: new Date() },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
              { student: { firstName: { contains: query.search, mode: 'insensitive' } } },
              { student: { lastName: { contains: query.search, mode: 'insensitive' } } },
              { student: { studentCode: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    if (actor.role === UserRole.PARENT) {
      const links = await this.prisma.parentStudent.findMany({
        where: { parent: { userId: actor.id, academyId } },
        select: { studentId: true },
      });
      where.studentId = { in: links.map((l) => l.studentId) };
    } else if (actor.role === UserRole.STUDENT) {
      const me = await this.prisma.student.findFirst({ where: { userId: actor.id, academyId } });
      where.studentId = me?.id ?? '__none__';
    }

    const [total, rows] = await Promise.all([
      this.prisma.feeInvoice.count({ where }),
      this.prisma.feeInvoice.findMany({
        where,
        orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
          feePlan: { select: { id: true, name: true } },
          _count: { select: { payments: true } },
        },
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async findInvoice(academyId: string, id: string, actor: AuthenticatedUser) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id, academyId },
      include: {
        student: { select: { id: true, studentCode: true, firstName: true, lastName: true, userId: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        feePlan: { select: { id: true, name: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    await this.assertVisibility(academyId, actor, invoice.student.id, invoice.student.userId);
    return invoice;
  }

  async updateInvoice(academyId: string, id: string, input: UpdateInvoiceInput, req: AuthenticatedRequest) {
    const before = await this.prisma.feeInvoice.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Invoice not found');
    if (before.status === FeeStatus.PAID) throw new BadRequestException('A paid invoice cannot be modified');

    const nextAmount = input.amountPaise ?? before.amountPaise;
    const nextDiscount = input.discountPaise ?? before.discountPaise;
    const nextTax = input.taxPaise ?? before.taxPaise;
    const nextLate = input.lateFeePaise ?? before.lateFeePaise;
    const totalPaise = computeInvoiceTotal({
      amountPaise: nextAmount,
      discountPaise: nextDiscount,
      taxPaise: nextTax,
      lateFeePaise: nextLate,
    });
    const balancePaise = Math.max(0, totalPaise - before.paidPaise);
    const derivedStatus =
      input.status ??
      (balancePaise === 0
        ? FeeStatus.PAID
        : before.paidPaise > 0
          ? FeeStatus.PARTIAL
          : before.status);

    const after = await this.prisma.feeInvoice.update({
      where: { id },
      data: {
        amountPaise: nextAmount,
        discountPaise: nextDiscount,
        taxPaise: nextTax,
        lateFeePaise: nextLate,
        dueDate: input.dueDate,
        scholarshipReason: input.scholarshipReason ?? undefined,
        notes: input.notes ?? undefined,
        totalPaise,
        balancePaise,
        status: derivedStatus,
      },
    });
    await this.audit.fromRequest(req, 'UPDATE', 'FeeInvoice', id, { before, after });
    return after;
  }

  async voidInvoice(academyId: string, id: string, req: AuthenticatedRequest) {
    const before = await this.prisma.feeInvoice.findFirst({ where: { id, academyId } });
    if (!before) throw new NotFoundException('Invoice not found');
    if (before.paidPaise > 0) throw new BadRequestException('Cannot void an invoice with payments — refund first');
    const after = await this.prisma.feeInvoice.update({
      where: { id },
      data: { status: FeeStatus.CANCELLED, balancePaise: 0 },
    });
    await this.audit.fromRequest(req, 'DELETE', 'FeeInvoice', id, { before, after });
    return after;
  }

  // ── Payments ─────────────────────────────────────────────────────────────
  async recordPayment(academyId: string, input: RecordPaymentInput, req: AuthenticatedRequest) {
    return this.applyPayment(academyId, {
      invoiceId: input.invoiceId,
      amountPaise: input.amountPaise,
      method: input.method,
      paidAt: input.paidAt ?? new Date(),
      notes: input.notes,
      gateway: input.method === PaymentMethod.RAZORPAY ? 'razorpay' : input.method.toLowerCase(),
      gatewayPaymentId: input.reference,
      collectedById: req.user?.id ?? null,
      status: PaymentStatus.CAPTURED,
      req,
    });
  }

  private async applyPayment(
    academyId: string,
    p: {
      invoiceId: string;
      amountPaise: number;
      method: PaymentMethod;
      paidAt: Date;
      notes?: string;
      gateway: string;
      gatewayPaymentId?: string;
      gatewayOrderId?: string;
      gatewaySignature?: string;
      gatewayResponse?: unknown;
      collectedById: string | null;
      status: PaymentStatus;
      req: AuthenticatedRequest;
    },
  ) {
    const invoice = await this.prisma.feeInvoice.findFirst({ where: { id: p.invoiceId, academyId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === FeeStatus.PAID) throw new BadRequestException('Invoice is already paid');
    if (invoice.status === FeeStatus.CANCELLED || invoice.status === FeeStatus.WAIVED) {
      throw new BadRequestException(`Cannot record payment against a ${invoice.status} invoice`);
    }
    if (p.amountPaise > invoice.balancePaise) {
      throw new BadRequestException('Payment amount exceeds invoice balance');
    }

    return this.prisma.$transaction(async (tx) => {
      const settings = await tx.academySetting.findUnique({ where: { academyId } });
      const prefix = settings?.receiptPrefix ?? 'RCT';
      const count = await tx.payment.count({ where: { academyId } });
      const receiptNumber = formatEntityCode(prefix, count + 1, 6);

      const payment = await tx.payment.create({
        data: {
          academyId,
          studentId: invoice.studentId,
          invoiceId: invoice.id,
          receiptNumber,
          amountPaise: p.amountPaise,
          method: p.method,
          status: p.status,
          gateway: p.gateway,
          gatewayOrderId: p.gatewayOrderId,
          gatewayPaymentId: p.gatewayPaymentId,
          gatewaySignature: p.gatewaySignature,
          gatewayResponse: p.gatewayResponse as Prisma.InputJsonValue | undefined,
          paidAt: p.paidAt,
          notes: p.notes,
          collectedById: p.collectedById ?? undefined,
        },
      });

      const nextPaid = invoice.paidPaise + p.amountPaise;
      const nextBalance = Math.max(0, invoice.totalPaise - nextPaid);
      const nextStatus =
        nextBalance === 0 ? FeeStatus.PAID : nextPaid > 0 ? FeeStatus.PARTIAL : invoice.status;
      const updated = await tx.feeInvoice.update({
        where: { id: invoice.id },
        data: { paidPaise: nextPaid, balancePaise: nextBalance, status: nextStatus },
      });

      await this.audit.fromRequest(p.req, 'PAYMENT', 'Payment', payment.id, {
        after: { paymentId: payment.id, receiptNumber, amountPaise: p.amountPaise, invoiceId: invoice.id },
      });
      return { payment, invoice: updated };
    });
  }

  async listPayments(academyId: string, actor: AuthenticatedUser, query: ListPaymentsQuery) {
    const where: Prisma.PaymentWhereInput = {
      academyId,
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.method ? { method: query.method } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            paidAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };
    if (actor.role === UserRole.PARENT) {
      const links = await this.prisma.parentStudent.findMany({
        where: { parent: { userId: actor.id, academyId } },
        select: { studentId: true },
      });
      where.studentId = { in: links.map((l) => l.studentId) };
    } else if (actor.role === UserRole.STUDENT) {
      const me = await this.prisma.student.findFirst({ where: { userId: actor.id, academyId } });
      where.studentId = me?.id ?? '__none__';
    }
    const [total, rows] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
          invoice: { select: { id: true, invoiceNumber: true, type: true } },
        },
      }),
    ]);
    return paginate(rows, query.page, query.pageSize, total);
  }

  async refundPayment(academyId: string, id: string, input: RefundPaymentInput, req: AuthenticatedRequest) {
    const payment = await this.prisma.payment.findFirst({ where: { id, academyId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.REFUNDED) throw new BadRequestException('Already refunded');
    const amount = input.amountPaise ?? payment.amountPaise;
    if (amount > payment.amountPaise) throw new BadRequestException('Refund exceeds paid amount');

    let gatewayResp: { id: string; amount: number; status: string } | null = null;
    if (payment.method === PaymentMethod.RAZORPAY && payment.gatewayPaymentId) {
      gatewayResp = await this.razorpay.refund(payment.gatewayPaymentId, amount);
    }

    return this.prisma.$transaction(async (tx) => {
      const refunded = await tx.payment.update({
        where: { id },
        data: {
          status:
            amount === payment.amountPaise ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
          refundedAt: new Date(),
          refundAmountPaise: amount,
          gatewayResponse: gatewayResp
            ? ({ refund: gatewayResp, reason: input.reason } as Prisma.InputJsonValue)
            : ({ reason: input.reason } as Prisma.InputJsonValue),
        },
      });
      if (payment.invoiceId) {
        const invoice = await tx.feeInvoice.findUnique({ where: { id: payment.invoiceId } });
        if (invoice) {
          const nextPaid = Math.max(0, invoice.paidPaise - amount);
          const nextBalance = Math.max(0, invoice.totalPaise - nextPaid);
          const nextStatus =
            nextBalance === 0
              ? FeeStatus.PAID
              : nextPaid === 0
                ? FeeStatus.REFUNDED
                : FeeStatus.PARTIAL;
          await tx.feeInvoice.update({
            where: { id: invoice.id },
            data: { paidPaise: nextPaid, balancePaise: nextBalance, status: nextStatus },
          });
        }
      }
      await this.audit.fromRequest(req, 'REFUND', 'Payment', id, {
        before: payment,
        after: { refundAmountPaise: amount, reason: input.reason },
      });
      return refunded;
    });
  }

  // ── Razorpay online payment flow ─────────────────────────────────────────
  async initiateRazorpay(academyId: string, invoiceId: string) {
    if (!this.razorpay.isConfigured) throw new BadRequestException('Online payments are not configured');
    const invoice = await this.prisma.feeInvoice.findFirst({ where: { id: invoiceId, academyId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.balancePaise <= 0) throw new BadRequestException('Invoice has no outstanding balance');

    const order = await this.razorpay.createOrder({
      amountPaise: invoice.balancePaise,
      receipt: invoice.invoiceNumber,
      notes: { academyId, invoiceId, studentId: invoice.studentId },
    });
    return {
      keyId: this.razorpay.keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      invoice: { id: invoice.id, number: invoice.invoiceNumber, balancePaise: invoice.balancePaise },
    };
  }

  async verifyRazorpay(
    academyId: string,
    invoiceId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string,
    req: AuthenticatedRequest,
  ) {
    if (!this.razorpay.verifyCheckoutSignature(razorpayOrderId, razorpayPaymentId, signature)) {
      throw new BadRequestException('Invalid Razorpay signature');
    }
    const invoice = await this.prisma.feeInvoice.findFirst({ where: { id: invoiceId, academyId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const existing = await this.prisma.payment.findUnique({ where: { gatewayPaymentId: razorpayPaymentId } });
    if (existing) return existing;

    return this.applyPayment(academyId, {
      invoiceId,
      amountPaise: invoice.balancePaise,
      method: PaymentMethod.RAZORPAY,
      paidAt: new Date(),
      gateway: 'razorpay',
      gatewayOrderId: razorpayOrderId,
      gatewayPaymentId: razorpayPaymentId,
      gatewaySignature: signature,
      collectedById: req.user?.id ?? null,
      status: PaymentStatus.CAPTURED,
      req,
    });
  }

  // ── Receipt PDF ──────────────────────────────────────────────────────────
  async renderReceiptPdf(academyId: string, paymentId: string, actor: AuthenticatedUser): Promise<Buffer> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, academyId },
      include: {
        invoice: true,
        student: {
          select: { id: true, studentCode: true, firstName: true, lastName: true, userId: true, guardianName: true },
        },
        academy: {
          select: { name: true, addressLine1: true, city: true, state: true, postalCode: true, contactEmail: true, contactPhone: true, primaryColor: true, logoUrl: true, taxNumber: true },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    await this.assertVisibility(academyId, actor, payment.studentId, payment.student?.userId ?? null);

    const templatePath = path.resolve(__dirname, 'templates', 'receipt.hbs');
    return this.pdf.renderTemplate({
      templatePath,
      context: {
        receiptNumber: payment.receiptNumber,
        paidAt: payment.paidAt?.toLocaleString('en-IN') ?? '—',
        method: payment.method,
        amountFormatted: formatINR(payment.amountPaise),
        amountPaise: payment.amountPaise,
        gatewayPaymentId: payment.gatewayPaymentId ?? '—',
        invoice: payment.invoice
          ? {
              number: payment.invoice.invoiceNumber,
              type: payment.invoice.type,
              totalFormatted: formatINR(payment.invoice.totalPaise),
              balanceFormatted: formatINR(payment.invoice.balancePaise),
              dueDate: payment.invoice.dueDate.toISOString().slice(0, 10),
            }
          : null,
        student: payment.student,
        academy: {
          ...payment.academy,
          address: [
            payment.academy?.addressLine1,
            payment.academy?.city,
            payment.academy?.state,
            payment.academy?.postalCode,
          ]
            .filter(Boolean)
            .join(', '),
        },
        primaryColor: payment.academy?.primaryColor ?? '#B91C1C',
      },
    });
  }

  // ── Visibility ───────────────────────────────────────────────────────────
  private async assertVisibility(
    academyId: string,
    actor: AuthenticatedUser,
    studentId: string | null,
    studentUserId: string | null,
  ): Promise<void> {
    if (actor.role === UserRole.SUPER_ADMIN) return;
    if (actor.role === UserRole.STUDENT) {
      if (studentUserId !== actor.id) throw new ForbiddenException('You may only view your own invoices');
      return;
    }
    if (actor.role === UserRole.PARENT) {
      if (!studentId) throw new ForbiddenException('Access denied');
      const link = await this.prisma.parentStudent.findFirst({
        where: { studentId, parent: { userId: actor.id, academyId } },
      });
      if (!link) throw new ForbiddenException('You may only view invoices for your children');
    }
  }

  // ── Late-fee sweeper (called by scheduled job) ───────────────────────────
  async applyLateFees(academyId: string): Promise<{ updated: number }> {
    const settings = await this.prisma.academySetting.findUnique({ where: { academyId } });
    if (!settings?.autoLateFeeEnabled) return { updated: 0 };
    const overdueInvoices = await this.prisma.feeInvoice.findMany({
      where: {
        academyId,
        status: { in: [FeeStatus.PENDING, FeeStatus.PARTIAL] },
        dueDate: { lt: new Date() },
        lateFeePaise: 0,
      },
      include: { feePlan: true },
    });
    let updated = 0;
    for (const inv of overdueInvoices) {
      const fee = inv.feePlan?.lateFeePaise ?? 0;
      if (fee <= 0) continue;
      const totalPaise = computeInvoiceTotal({
        amountPaise: inv.amountPaise,
        discountPaise: inv.discountPaise,
        taxPaise: inv.taxPaise,
        lateFeePaise: fee,
      });
      const balancePaise = Math.max(0, totalPaise - inv.paidPaise);
      await this.prisma.feeInvoice.update({
        where: { id: inv.id },
        data: {
          lateFeePaise: fee,
          totalPaise,
          balancePaise,
          status: FeeStatus.OVERDUE,
        },
      });
      updated++;
    }
    if (updated > 0) this.logger.log(`Applied late fees to ${updated} invoices for academy ${academyId}`);
    return { updated };
  }
}

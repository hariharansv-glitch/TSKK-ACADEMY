import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';

import { FeesService } from './fees.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permissions } from '@common/decorators/permissions.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Tenant } from '@common/decorators/tenant.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  CreateFeePlanDto,
  createFeePlanSchema,
  CreateInvoiceDto,
  createInvoiceSchema,
  ListInvoicesQueryDto,
  listInvoicesSchema,
  UpdateFeePlanDto,
  updateFeePlanSchema,
  UpdateInvoiceDto,
  updateInvoiceSchema,
} from './dto/fee.dto';
import {
  InitiateRazorpayDto,
  initiateRazorpaySchema,
  ListPaymentsQueryDto,
  listPaymentsSchema,
  RecordPaymentDto,
  recordPaymentSchema,
  RefundPaymentDto,
  refundPaymentSchema,
  VerifyRazorpayDto,
  verifyRazorpaySchema,
} from './dto/payment.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@common/types/authenticated-request';

class InvoiceDtoResponse {}
class PaymentDtoResponse {}

@ApiTags('fees')
@ApiBearerAuth('access-token')
@UseGuards(TenantGuard)
@Controller('fees')
export class FeesController {
  constructor(private readonly service: FeesService) {}

  // ── Fee plans ─────────────────────────────────────────────────────────────
  @Get('plans')
  @Permissions('fee.view')
  @ApiOperation({ summary: 'List fee plans for the current academy' })
  listPlans(@Tenant({ required: true }) academyId: string) {
    return this.service.listPlans(academyId);
  }

  @Post('plans')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.ACCOUNTANT)
  @Permissions('fee.create')
  @ApiOperation({ summary: 'Create a fee plan' })
  createPlan(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createFeePlanSchema)) body: CreateFeePlanDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createPlan(academyId, body as never, req);
  }

  @Patch('plans/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.ACCOUNTANT)
  @Permissions('fee.update')
  @ApiOperation({ summary: 'Update a fee plan' })
  updatePlan(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFeePlanSchema)) body: UpdateFeePlanDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updatePlan(academyId, id, body as never, req);
  }

  @Delete('plans/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('fee.delete')
  @ApiOperation({ summary: 'Deactivate a fee plan' })
  removePlan(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.removePlan(academyId, id, req);
  }

  // ── Invoices ─────────────────────────────────────────────────────────────
  @Post('invoices')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT)
  @Permissions('fee.create')
  @ApiOperation({ summary: 'Create a fee invoice for a student' })
  createInvoice(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(createInvoiceSchema)) body: CreateInvoiceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createInvoice(academyId, body as never, req);
  }

  @Get('invoices')
  @Permissions('fee.view')
  @ApiPaginatedResponse(InvoiceDtoResponse)
  @ApiOperation({ summary: 'List fee invoices' })
  listInvoices(
    @Tenant({ required: true }) academyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listInvoicesSchema)) query: ListInvoicesQueryDto,
  ) {
    return this.service.listInvoices(academyId, user, query as never);
  }

  @Get('invoices/:id')
  @Permissions('fee.view')
  @ApiOperation({ summary: 'Get an invoice by id' })
  invoiceDetail(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findInvoice(academyId, id, user);
  }

  @Patch('invoices/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.ACCOUNTANT)
  @Permissions('fee.update')
  @ApiOperation({ summary: 'Update an unpaid invoice' })
  updateInvoice(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInvoiceSchema)) body: UpdateInvoiceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateInvoice(academyId, id, body as never, req);
  }

  @Delete('invoices/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN)
  @Permissions('fee.delete')
  @ApiOperation({ summary: 'Void an invoice (only when no payments applied)' })
  voidInvoice(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.voidInvoice(academyId, id, req);
  }

  // ── Payments ─────────────────────────────────────────────────────────────
  @Post('payments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT)
  @Permissions('payment.collect')
  @ApiOperation({ summary: 'Record an offline payment for an invoice' })
  record(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(recordPaymentSchema)) body: RecordPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.recordPayment(academyId, body as never, req);
  }

  @Get('payments')
  @Permissions('payment.view')
  @ApiPaginatedResponse(PaymentDtoResponse)
  @ApiOperation({ summary: 'List payments' })
  listPayments(
    @Tenant({ required: true }) academyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listPaymentsSchema)) query: ListPaymentsQueryDto,
  ) {
    return this.service.listPayments(academyId, user, query as never);
  }

  @Post('payments/:id/refund')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ACADEMY_ADMIN, UserRole.ACCOUNTANT)
  @Permissions('payment.refund')
  @ApiOperation({ summary: 'Refund a payment (issues Razorpay refund when applicable)' })
  refund(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(refundPaymentSchema)) body: RefundPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.refundPayment(academyId, id, body as never, req);
  }

  @Get('payments/:id/receipt.pdf')
  @Permissions('payment.view')
  @ApiOperation({ summary: 'Download the receipt PDF for a payment' })
  @ApiProduces('application/pdf')
  async receiptPdf(
    @Tenant({ required: true }) academyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: false }) res: Response,
  ) {
    const pdf = await this.service.renderReceiptPdf(academyId, id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${id}.pdf"`);
    res.setHeader('Content-Length', pdf.length.toString());
    res.end(pdf);
  }

  // ── Razorpay online flow ─────────────────────────────────────────────────
  @Post('razorpay/orders')
  @ApiOperation({ summary: 'Create a Razorpay order for an invoice' })
  initiate(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(initiateRazorpaySchema)) body: InitiateRazorpayDto,
  ) {
    return this.service.initiateRazorpay(academyId, body.invoiceId);
  }

  @Post('razorpay/verify')
  @ApiOperation({ summary: 'Verify a Razorpay checkout signature and mark payment' })
  verify(
    @Tenant({ required: true }) academyId: string,
    @Body(new ZodValidationPipe(verifyRazorpaySchema)) body: VerifyRazorpayDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.verifyRazorpay(
      academyId,
      body.invoiceId,
      body.razorpayOrderId,
      body.razorpayPaymentId,
      body.razorpaySignature,
      req,
    );
  }
}

import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@prisma/client';
import { PaymentsService } from './payments.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('stores/:storeId/pavilions/:pavilionId/payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  private parseMonthInput(value: string): Date {
    const raw = String(value ?? '').trim();
    const ym = /^(\d{4})-(\d{2})$/.exec(raw);
    if (ym) {
      const year = Number(ym[1]);
      const month = Number(ym[2]);
      if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        throw new BadRequestException('period must be in YYYY-MM format');
      }
      return new Date(year, month - 1, 1);
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid period');
    }

    // Normalize by UTC year/month to avoid timezone-dependent month shifts.
    return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1);
  }

  @Post()
  @Permissions(Permission.CREATE_PAYMENTS)
  addPayment(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Req() req: any,
    @Body()
    body: {
      period: string;
      rentPaid?: number;
      utilitiesPaid?: number;
      advertisingPaid?: number;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
      rentBankTransferPaid?: number;
      rentCashbox1Paid?: number;
      rentCashbox2Paid?: number;
      utilitiesBankTransferPaid?: number;
      utilitiesCashbox1Paid?: number;
      utilitiesCashbox2Paid?: number;
      advertisingBankTransferPaid?: number;
      advertisingCashbox1Paid?: number;
      advertisingCashbox2Paid?: number;
      idempotencyKey?: string;
    },
  ) {
    const period = this.parseMonthInput(body.period);
    return this.service.addPayment(pavilionId, period, {
      rentPaid: body.rentPaid,
      utilitiesPaid: body.utilitiesPaid,
      advertisingPaid: body.advertisingPaid,
      bankTransferPaid: body.bankTransferPaid,
      cashbox1Paid: body.cashbox1Paid,
      cashbox2Paid: body.cashbox2Paid,
      rentBankTransferPaid: body.rentBankTransferPaid,
      rentCashbox1Paid: body.rentCashbox1Paid,
      rentCashbox2Paid: body.rentCashbox2Paid,
      utilitiesBankTransferPaid: body.utilitiesBankTransferPaid,
      utilitiesCashbox1Paid: body.utilitiesCashbox1Paid,
      utilitiesCashbox2Paid: body.utilitiesCashbox2Paid,
      advertisingBankTransferPaid: body.advertisingBankTransferPaid,
      advertisingCashbox1Paid: body.advertisingCashbox1Paid,
      advertisingCashbox2Paid: body.advertisingCashbox2Paid,
      idempotencyKey: body.idempotencyKey,
    }, req.user.id);
  }

  @Get()
  @Permissions(Permission.VIEW_PAYMENTS)
  list(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('paginated') paginated?: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return this.service.list(pavilionId, {
      period: period ? this.parseMonthInput(period) : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      paginated: paginated === 'true' || paginated === '1',
    });
  }

  @Get('summary')
  @Permissions(Permission.VIEW_PAYMENTS)
  getMonthlySummary(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Query('period') period: string,
  ) {
    return this.service.getMonthlySummary(pavilionId, this.parseMonthInput(period));
  }

  @Delete('entries/:entryId')
  @Permissions(Permission.EDIT_PAYMENTS)
  deleteEntry(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Req() req: any,
  ) {
    return this.service.deleteEntry(pavilionId, entryId, req.user.id);
  }

  @Patch('entries/:entryId')
  @Permissions(Permission.EDIT_PAYMENTS)
  updateEntry(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Req() req: any,
    @Body()
    body: {
      rentPaid?: number;
      utilitiesPaid?: number;
      advertisingPaid?: number;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
      rentBankTransferPaid?: number;
      rentCashbox1Paid?: number;
      rentCashbox2Paid?: number;
      utilitiesBankTransferPaid?: number;
      utilitiesCashbox1Paid?: number;
      utilitiesCashbox2Paid?: number;
      advertisingBankTransferPaid?: number;
      advertisingCashbox1Paid?: number;
      advertisingCashbox2Paid?: number;
    },
  ) {
    const hasAnyField =
      Object.keys(body).length > 0 &&
      Object.values(body).some((value) => value !== undefined);
    if (!hasAnyField) {
      throw new BadRequestException('No fields provided for update');
    }
    return this.service.updateEntry(pavilionId, entryId, body, req.user.id);
  }
}

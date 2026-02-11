import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Param,
  ParseIntPipe,
  UseGuards,
  Query,
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

  @Post()
  @Permissions(Permission.CREATE_PAYMENTS)
  addPayment(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Body()
    body: {
      period: string;
      rentPaid?: number;
      utilitiesPaid?: number;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    },
  ) {
    const period = new Date(body.period);
    return this.service.addPayment(pavilionId, period, {
      rentPaid: body.rentPaid,
      utilitiesPaid: body.utilitiesPaid,
      bankTransferPaid: body.bankTransferPaid,
      cashbox1Paid: body.cashbox1Paid,
      cashbox2Paid: body.cashbox2Paid,
    });
  }

  @Get()
  @Permissions(Permission.VIEW_PAYMENTS)
  list(@Param('pavilionId', ParseIntPipe) pavilionId: number) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return this.service.list(pavilionId);
  }

  @Get('summary')
  @Permissions(Permission.VIEW_PAYMENTS)
  getMonthlySummary(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Query('period') period: string,
  ) {
    return this.service.getMonthlySummary(pavilionId, new Date(period));
  }

  @Delete('entries/:entryId')
  @Permissions(Permission.EDIT_PAYMENTS)
  deleteEntry(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('entryId', ParseIntPipe) entryId: number,
  ) {
    return this.service.deleteEntry(pavilionId, entryId);
  }
}

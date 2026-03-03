import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { AdditionalChargeService } from './additional-charge.service';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('pavilions/:pavilionId/additional-charges')
export class AdditionalChargeController {
  constructor(private service: AdditionalChargeService) {}

  @Post(':id/pay')
  @Permissions(Permission.CREATE_CHARGES)
  payCharge(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      amountPaid: number;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    },
    @Req() req: any,
  ) {
    return this.service.payCharge(id, body.amountPaid, {
      bankTransferPaid: body.bankTransferPaid,
      cashbox1Paid: body.cashbox1Paid,
      cashbox2Paid: body.cashbox2Paid,
    }, req.user.id);
  }

  @Get(':id/payments')
  @Permissions(Permission.VIEW_CHARGES)
  listPayments(@Param('id', ParseIntPipe) id: number) {
    return this.service.listPayments(id);
  }

  @Post()
  @Permissions(Permission.CREATE_CHARGES)
  create(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Body() data: { name: string; amount: number },
    @Req() req: any,
  ) {
    return this.service.create(pavilionId, data, req.user.id);
  }

  @Get()
  @Permissions(Permission.VIEW_CHARGES)
  findAll(@Param('pavilionId', ParseIntPipe) pavilionId: number) {
    return this.service.findAll(pavilionId);
  }

  @Patch(':chargeId')
  @Permissions(Permission.EDIT_CHARGES)
  update(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('chargeId', ParseIntPipe) chargeId: number,
    @Body() data: { name?: string; amount?: number },
    @Req() req: any,
  ) {
    return this.service.update(pavilionId, chargeId, data, req.user.id);
  }

  @Delete(':chargeId')
  @Permissions(Permission.DELETE_CHARGES)
  delete(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('chargeId', ParseIntPipe) chargeId: number,
    @Req() req: any,
  ) {
    return this.service.delete(pavilionId, chargeId, req.user.id);
  }

  @Delete(':chargeId/payments/:paymentId')
  @Permissions(Permission.DELETE_CHARGES)
  deletePayment(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('chargeId', ParseIntPipe) chargeId: number,
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Req() req: any,
  ) {
    return this.service.deletePayment(pavilionId, chargeId, paymentId, req.user.id);
  }

  @Patch(':chargeId/payments/:paymentId')
  @Permissions(Permission.EDIT_CHARGES)
  updatePayment(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('chargeId', ParseIntPipe) chargeId: number,
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Body()
    body: {
      amountPaid?: number;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    },
    @Req() req: any,
  ) {
    return this.service.updatePayment(pavilionId, chargeId, paymentId, body, req.user.id);
  }
}

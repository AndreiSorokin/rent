import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
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
    },
  ) {
    const period = new Date(body.period);
    return this.service.addPayment(pavilionId, period, {
      rentPaid: body.rentPaid,
      utilitiesPaid: body.utilitiesPaid,
    });
  }

  @Get()
  @Permissions(Permission.VIEW_PAYMENTS)
  list(@Param('pavilionId', ParseIntPipe) pavilionId: number) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return this.service.list(pavilionId);
  }
}

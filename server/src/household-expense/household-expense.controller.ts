import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PavilionExpenseStatus, Permission } from '@prisma/client';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { HouseholdExpenseService } from './household-expense.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('stores/:storeId/household-expenses')
export class HouseholdExpenseController {
  constructor(private readonly service: HouseholdExpenseService) {}

  @Get()
  @Permissions(Permission.VIEW_CHARGES)
  list(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.service.list(storeId);
  }

  @Post()
  @Permissions(Permission.CREATE_CHARGES)
  create(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() data: { name: string; amount: number },
  ) {
    return this.service.create(storeId, data);
  }

  @Delete(':expenseId')
  @Permissions(Permission.DELETE_CHARGES)
  delete(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
  ) {
    return this.service.delete(storeId, expenseId);
  }

  @Patch(':expenseId')
  @Permissions(Permission.EDIT_CHARGES)
  update(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body()
    data: {
      name?: string;
      amount?: number;
      status?: PavilionExpenseStatus;
      paymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2';
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    },
  ) {
    return this.service.update(storeId, expenseId, data);
  }

  @Patch(':expenseId/status')
  @Permissions(Permission.EDIT_CHARGES)
  updateStatus(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body()
    data: {
      status: PavilionExpenseStatus;
      paymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2';
    },
  ) {
    return this.service.updateStatus(
      storeId,
      expenseId,
      data.status,
      data.paymentMethod,
    );
  }
}

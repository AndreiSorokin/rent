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
import { PavilionExpenseStatus, PavilionExpenseType, Permission } from '@prisma/client';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { PavilionExpensesService } from './pavilion-expenses.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('pavilions/:pavilionId/expenses')
export class PavilionExpensesController {
  constructor(private readonly service: PavilionExpensesService) {}

  @Get()
  @Permissions(Permission.VIEW_PAYMENTS)
  list(@Param('pavilionId', ParseIntPipe) pavilionId: number) {
    return this.service.list(pavilionId);
  }

  @Post()
  @Permissions(Permission.CREATE_CHARGES)
  create(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Body()
    data: {
      type: PavilionExpenseType;
      amount: number;
      note?: string | null;
      status?: PavilionExpenseStatus;
    },
  ) {
    return this.service.create(pavilionId, data);
  }

  @Patch(':expenseId/status')
  @Permissions(Permission.EDIT_CHARGES)
  updateStatus(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body() data: { status: PavilionExpenseStatus },
  ) {
    return this.service.updateStatus(pavilionId, expenseId, data.status);
  }

  @Delete(':expenseId')
  @Permissions(Permission.DELETE_CHARGES)
  delete(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
  ) {
    return this.service.delete(pavilionId, expenseId);
  }
}

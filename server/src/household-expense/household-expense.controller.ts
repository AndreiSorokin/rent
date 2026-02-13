import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Permission } from '@prisma/client';
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
}

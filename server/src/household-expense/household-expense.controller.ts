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
@Controller('pavilions/:pavilionId/household-expenses')
export class HouseholdExpenseController {
  constructor(private readonly service: HouseholdExpenseService) {}

  @Get()
  @Permissions(Permission.VIEW_CHARGES)
  list(@Param('pavilionId', ParseIntPipe) pavilionId: number) {
    return this.service.list(pavilionId);
  }

  @Post()
  @Permissions(Permission.CREATE_CHARGES)
  create(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Body() data: { name: string; amount: number },
  ) {
    return this.service.create(pavilionId, data);
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

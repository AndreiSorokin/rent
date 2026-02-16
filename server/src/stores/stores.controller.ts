import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  Delete,
  Patch,
  UseGuards,
  Req,
} from '@nestjs/common';
import { StoresService } from './stores.service';
import { Currency, Permission, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { Permissions } from 'src/auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('stores')
export class StoresController {
  constructor(private readonly service: StoresService) {}

  @Get('my')
  findMyStores(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = req.user.id;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.service.findUserStores(userId);
  }

  @Post()
  create(@Body() data: Prisma.StoreCreateInput, @Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const userId = req.user.id;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.service.create(data, userId);
  }

  @Get()
  findAll(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.service.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.service.findOne(id, req.user.id);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) storeId: number, @Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = req.user.id;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.service.delete(storeId, userId);
  }

  @Patch(':storeId/currency')
  @Permissions(Permission.ASSIGN_PERMISSIONS)
  updateCurrency(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() data: { currency: Currency },
    @Req() req: any,
  ) {
    return this.service.updateCurrency(storeId, req.user.id, data.currency);
  }

  @Post(':storeId/staff')
  @Permissions(Permission.ASSIGN_PERMISSIONS)
  createStaff(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() data: { fullName: string; position: string; salary?: number },
    @Req() req: any,
  ) {
    return this.service.createStaff(storeId, req.user.id, data);
  }

  @Patch(':storeId/staff/:staffId')
  @Permissions(Permission.EDIT_CHARGES)
  updateStaff(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
    @Body() data: { salary?: number; salaryStatus?: 'UNPAID' | 'PAID' },
    @Req() req: any,
  ) {
    return this.service.updateStaff(storeId, staffId, req.user.id, data);
  }

  @Delete(':storeId/staff/:staffId')
  @Permissions(Permission.ASSIGN_PERMISSIONS)
  deleteStaff(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
    @Req() req: any,
  ) {
    return this.service.deleteStaff(storeId, staffId, req.user.id);
  }

  @Patch(':storeId/expenses/statuses')
  @Permissions(Permission.EDIT_CHARGES)
  updateExpenseStatuses(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body()
    data: {
      utilitiesExpenseStatus?: 'UNPAID' | 'PAID';
      householdExpenseStatus?: 'UNPAID' | 'PAID';
    },
    @Req() req: any,
  ) {
    return this.service.updateExpenseStatuses(storeId, req.user.id, data);
  }

  @Get(':storeId/accounting-table')
  @Permissions(Permission.VIEW_PAYMENTS)
  listAccountingTable(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.service.listAccountingTable(storeId);
  }

  @Post(':storeId/accounting-table')
  @Permissions(Permission.CREATE_PAYMENTS)
  createAccountingRecord(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body()
    data: {
      recordDate: string;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    },
  ) {
    return this.service.createAccountingRecord(storeId, data);
  }

  @Delete(':storeId/accounting-table/:recordId')
  @Permissions(Permission.EDIT_PAYMENTS)
  deleteAccountingRecord(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('recordId', ParseIntPipe) recordId: number,
  ) {
    return this.service.deleteAccountingRecord(storeId, recordId);
  }

  @Post(':storeId/import-data')
  @Permissions(Permission.ASSIGN_PERMISSIONS)
  importData(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body()
    data: {
      pavilions?: Array<{
        number: string;
        category?: string | null;
        squareMeters: number;
        pricePerSqM: number;
        status?: 'AVAILABLE' | 'RENTED' | 'PREPAID';
        tenantName?: string | null;
        utilitiesAmount?: number | null;
        advertisingAmount?: number | null;
      }>;
      householdExpenses?: Array<{
        name: string;
        amount: number;
        status?: 'UNPAID' | 'PAID';
      }>;
      expenses?: Array<{
        type:
          | 'PAYROLL_TAX'
          | 'PROFIT_TAX'
          | 'DIVIDENDS'
          | 'BANK_SERVICES'
          | 'VAT'
          | 'LAND_RENT'
          | 'OTHER';
        amount: number;
        status?: 'UNPAID' | 'PAID';
        note?: string | null;
      }>;
      accounting?: Array<{
        recordDate: string;
        bankTransferPaid?: number;
        cashbox1Paid?: number;
        cashbox2Paid?: number;
      }>;
      staff?: Array<{
        fullName: string;
        position: string;
        salary?: number;
        salaryStatus?: 'UNPAID' | 'PAID';
      }>;
    },
    @Req() req: any,
  ) {
    return this.service.importData(storeId, req.user.id, data);
  }
}

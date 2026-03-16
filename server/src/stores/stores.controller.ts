import {
  BadRequestException,
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
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { StoresService } from './stores.service';
import { Currency, Permission, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { ReorderStaffDto } from './dto/reorder-staff.dto';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

const decodeUploadFileName = (value: string) => {
  try {
    const decoded = Buffer.from(value, 'latin1').toString('utf8');
    return decoded.includes('\uFFFD') ? value : decoded;
  } catch {
    return value;
  }
};

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
  create(
    @Body()
    data: {
      name: string;
      address?: string | null;
      description?: string | null;
      contactPhone?: string | null;
      contactEmail?: string | null;
      currency?: Currency;
      timeZone?: string | null;
    },
    @Req() req: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const userId = req.user.id;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.service.create(
      {
        name: data.name,
        address: data.address ?? null,
        description: data.description ?? null,
        contactPhone: data.contactPhone ?? null,
        contactEmail: data.contactEmail ?? null,
        currency: data.currency,
        timeZone: data.timeZone ?? undefined,
      } as Prisma.StoreCreateInput,
      userId,
    );
  }

  @Get()
  findAll(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.service.findAll(req.user.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Query('lite') lite?: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.service.findOne(id, req.user.id, {
      lite: lite === 'true' || lite === '1',
    });
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

  @Patch(':storeId/timezone')
  @Permissions(Permission.ASSIGN_PERMISSIONS)
  updateTimeZone(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() data: { timeZone: string },
    @Req() req: any,
  ) {
    return this.service.updateTimeZone(storeId, req.user.id, data.timeZone);
  }

  @Patch(':storeId/name')
  @Permissions(Permission.ASSIGN_PERMISSIONS)
  updateName(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() data: { name: string },
    @Req() req: any,
  ) {
    return this.service.updateName(storeId, req.user.id, data.name);
  }

  @Patch(':storeId/address')
  @Permissions(Permission.ASSIGN_PERMISSIONS)
  updateAddress(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() data: { address?: string | null },
    @Req() req: any,
  ) {
    return this.service.updateAddress(storeId, req.user.id, data.address ?? null);
  }

  @Patch(':storeId/contact')
  @Permissions(Permission.ASSIGN_PERMISSIONS)
  updateContact(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() data: { contactPhone?: string | null; contactEmail?: string | null },
    @Req() req: any,
  ) {
    return this.service.updateContact(
      storeId,
      req.user.id,
      data.contactPhone ?? null,
      data.contactEmail ?? null,
    );
  }

  @Patch(':storeId/description')
  @Permissions('MANAGE_MEDIA' as Permission)
  updateDescription(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() data: { description?: string | null },
    @Req() req: any,
  ) {
    return this.service.updateDescription(
      storeId,
      req.user.id,
      data.description ?? null,
    );
  }

  @Post(':storeId/image')
  @Permissions('MANAGE_MEDIA' as Permission)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = join(process.cwd(), 'uploads', 'store-media');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const decodedOriginalName = decodeUploadFileName(file.originalname);
          cb(null, `${unique}${extname(decodedOriginalName)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|webp)$/i;
        if (!allowed.test(file.originalname)) {
          return cb(new BadRequestException('Поддерживаются только изображения JPG, PNG и WEBP'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadImage(
    @Param('storeId', ParseIntPipe) storeId: number,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Файл изображения обязателен');
    }

    return this.service.updateImage(
      storeId,
      req.user.id,
      `/uploads/store-media/${file.filename}`,
    );
  }

  @Delete(':storeId/image')
  @Permissions('MANAGE_MEDIA' as Permission)
  deleteImage(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Req() req: any,
  ) {
    return this.service.deleteImage(storeId, req.user.id);
  }

  @Get(':storeId/media')
  @Permissions('MANAGE_MEDIA' as Permission)
  listMedia(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Req() req: any,
  ) {
    return this.service.listMedia(storeId, req.user.id);
  }

  @Post(':storeId/media')
  @Permissions('MANAGE_MEDIA' as Permission)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'files', maxCount: 20 }], {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = join(process.cwd(), 'uploads', 'store-media');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const decodedOriginalName = decodeUploadFileName(file.originalname);
          cb(null, `${unique}${extname(decodedOriginalName)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|webp)$/i;
        if (!allowed.test(file.originalname)) {
          return cb(new BadRequestException('Поддерживаются только изображения JPG, PNG и WEBP'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadMedia(
    @Param('storeId', ParseIntPipe) storeId: number,
    @UploadedFiles() files: { files?: any[] },
    @Req() req: any,
  ) {
    const uploaded = files?.files || [];
    if (uploaded.length === 0) {
      throw new BadRequestException('Нужно выбрать хотя бы одно изображение');
    }

    return this.service.addImages(
      storeId,
      req.user.id,
      uploaded.map((file) => `/uploads/store-media/${file.filename}`),
    );
  }

  @Delete(':storeId/media/:imageId')
  @Permissions('MANAGE_MEDIA' as Permission)
  deleteMediaItem(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
    @Req() req: any,
  ) {
    return this.service.deleteMediaItem(storeId, imageId, req.user.id);
  }

  @Post(':storeId/pavilion-categories')
  @Permissions(Permission.EDIT_PAVILIONS)
  addPavilionCategory(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() data: { name: string },
    @Req() req: any,
  ) {
    return this.service.addPavilionCategory(storeId, req.user.id, data.name);
  }

  @Patch(':storeId/pavilion-categories/:oldName')
  @Permissions(Permission.EDIT_PAVILIONS)
  renamePavilionCategory(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('oldName') oldName: string,
    @Body() data: { newName: string },
    @Req() req: any,
  ) {
    return this.service.renamePavilionCategory(
      storeId,
      req.user.id,
      oldName,
      data.newName,
    );
  }

  @Delete(':storeId/pavilion-categories/:name')
  @Permissions(Permission.EDIT_PAVILIONS)
  deletePavilionCategory(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('name') name: string,
    @Req() req: any,
  ) {
    return this.service.deletePavilionCategory(storeId, req.user.id, name);
  }

  @Post(':storeId/pavilion-groups')
  @Permissions(Permission.EDIT_PAVILIONS)
  createPavilionGroup(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() data: { name: string },
    @Req() req: any,
  ) {
    return this.service.createPavilionGroup(storeId, req.user.id, data);
  }

  @Post(':storeId/pavilions/:pavilionId/pavilion-groups/:groupId')
  @Permissions(Permission.EDIT_PAVILIONS)
  addPavilionToGroup(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Req() req: any,
  ) {
    return this.service.addPavilionToGroup(storeId, pavilionId, groupId, req.user.id);
  }

  @Patch(':storeId/pavilion-groups/:groupId')
  @Permissions(Permission.EDIT_PAVILIONS)
  renamePavilionGroup(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() data: { name: string },
    @Req() req: any,
  ) {
    return this.service.renamePavilionGroup(storeId, groupId, req.user.id, data);
  }

  @Delete(':storeId/pavilion-groups/:groupId')
  @Permissions(Permission.EDIT_PAVILIONS)
  deletePavilionGroup(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Req() req: any,
  ) {
    return this.service.deletePavilionGroup(storeId, groupId, req.user.id);
  }

  @Delete(':storeId/pavilions/:pavilionId/pavilion-groups/:groupId')
  @Permissions(Permission.EDIT_PAVILIONS)
  removePavilionFromGroup(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Req() req: any,
  ) {
    return this.service.removePavilionFromGroup(storeId, pavilionId, groupId, req.user.id);
  }

  @Post(':storeId/staff')
  @Permissions(Permission.MANAGE_STAFF)
  createStaff(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body()
    data: {
      fullName: string;
      position: string;
      salary?: number;
      idempotencyKey?: string;
    },
    @Req() req: any,
  ) {
    return this.service.createStaff(storeId, req.user.id, data);
  }

  @Patch(':storeId/staff/reorder')
  @Permissions(Permission.MANAGE_STAFF)
  reorderStaff(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() dto: ReorderStaffDto,
    @Req() req: any,
  ) {
    return this.service.reorderStaff(storeId, req.user.id, dto.orderedIds);
  }

  @Patch(':storeId/staff/:staffId')
  @Permissions(Permission.MANAGE_STAFF)
  updateStaff(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
    @Body()
    data: {
      salary?: number;
      salaryStatus?: 'UNPAID' | 'PAID';
      salaryPaymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2';
      salaryBankTransferPaid?: number;
      salaryCashbox1Paid?: number;
      salaryCashbox2Paid?: number;
    },
    @Req() req: any,
  ) {
    return this.service.updateStaff(storeId, staffId, req.user.id, data);
  }

  @Delete(':storeId/staff/:staffId')
  @Permissions(Permission.MANAGE_STAFF)
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

  @Get(':storeId/activity')
  @Permissions('VIEW_ACTIVITY' as Permission)
  listStoreActivity(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('date') date?: string,
    @Query('pavilion') pavilion?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
  ) {
    return this.service.listActivity(storeId, req.user.id, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      date,
      pavilion,
      action,
      entityType,
    });
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
    @Req() req: any,
  ) {
    return this.service.createAccountingRecord(storeId, req.user.id, data);
  }

  @Delete(':storeId/accounting-table/:recordId')
  @Permissions(Permission.EDIT_PAYMENTS)
  deleteAccountingRecord(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('recordId', ParseIntPipe) recordId: number,
    @Req() req: any,
  ) {
    return this.service.deleteAccountingRecord(storeId, recordId, req.user.id);
  }

  @Get(':storeId/extra-income')
  @Permissions(Permission.VIEW_PAYMENTS)
  listStoreExtraIncome(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query('period') period?: string,
  ) {
    return this.service.listStoreExtraIncome(storeId, period);
  }

  @Post(':storeId/extra-income')
  @Permissions(Permission.CREATE_PAYMENTS)
  createStoreExtraIncome(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body()
    data: {
      name: string;
      amount: number;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
      period?: string;
      paidAt?: string;
      idempotencyKey?: string;
    },
    @Req() req: any,
  ) {
    return this.service.createStoreExtraIncome(storeId, req.user.id, data);
  }

  @Patch(':storeId/extra-income/:incomeId')
  @Permissions(Permission.EDIT_PAYMENTS)
  updateStoreExtraIncome(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('incomeId', ParseIntPipe) incomeId: number,
    @Body()
    data: {
      name?: string;
      amount?: number;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
      period?: string;
      paidAt?: string;
    },
    @Req() req: any,
  ) {
    return this.service.updateStoreExtraIncome(storeId, incomeId, req.user.id, data);
  }

  @Delete(':storeId/extra-income/:incomeId')
  @Permissions(Permission.EDIT_PAYMENTS)
  deleteStoreExtraIncome(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('incomeId', ParseIntPipe) incomeId: number,
    @Req() req: any,
  ) {
    return this.service.deleteStoreExtraIncome(storeId, incomeId, req.user.id);
  }

  @Get(':storeId/accounting-reconciliation')
  @Permissions(Permission.VIEW_PAYMENTS)
  getAccountingReconciliation(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query('date') date?: string,
  ) {
    return this.service.getAccountingDayReconciliation(storeId, date);
  }

  @Get(':storeId/accounting-reconciliation/expected-close-details')
  @Permissions(Permission.VIEW_PAYMENTS)
  getAccountingExpectedCloseDetails(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query('date') date?: string,
  ) {
    return this.service.getAccountingExpectedCloseDetails(storeId, date);
  }

  @Post(':storeId/accounting-reconciliation/open')
  @Permissions(Permission.CREATE_PAYMENTS)
  openAccountingDay(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body()
    data: {
      date?: string;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    },
    @Req() req: any,
  ) {
    return this.service.openAccountingDay(storeId, req.user.id, data);
  }

  @Post(':storeId/accounting-reconciliation/close')
  @Permissions(Permission.CREATE_PAYMENTS)
  closeAccountingDay(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body()
    data: {
      date?: string;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
      forceClose?: boolean;
    },
    @Req() req: any,
  ) {
    return this.service.closeAccountingDay(storeId, req.user.id, data);
  }

  @Post(':storeId/import-data')
  @Permissions(Permission.CREATE_PAVILIONS)
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

  @Get(':storeId/export-data')
  @Permissions(Permission.EXPORT_STORE_DATA)
  exportData(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Req() req: any,
  ) {
    return this.service.exportData(storeId, req.user.id);
  }
}

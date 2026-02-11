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
    @Body() data: { fullName: string; position: string },
    @Req() req: any,
  ) {
    return this.service.createStaff(storeId, req.user.id, data);
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
}

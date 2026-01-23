import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PavilionsService } from './pavilions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission, PavilionStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('stores/:storeId/pavilions')
export class PavilionsController {
  constructor(private readonly service: PavilionsService) {}

  @Post()
  @Permissions(Permission.EDIT_PAVILIONS)
  create(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body()
    data: {
      number: string;
      squareMeters: number;
      pricePerSqM: number;
      status?: PavilionStatus;
    },
  ) {
    return this.service.create(storeId, data);
  }

  @Get()
  @Permissions(Permission.VIEW_PAVILIONS)
  findAll(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.service.findAll(storeId);
  }

  @Get(':id')
  @Permissions(Permission.VIEW_PAVILIONS)
  findOne(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.findOne(storeId, id);
  }

  @Patch(':id')
  @Permissions(Permission.EDIT_PAVILIONS)
  update(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    data: Partial<{
      number: string;
      squareMeters: number;
      pricePerSqM: number;
      status: PavilionStatus;
      tenantName: string | null;
      rentAmount: number | null;
      utilitiesAmount: number | null;
    }>,
  ) {
    return this.service.update(storeId, id, data);
  }

  @Delete(':id')
  @Permissions(Permission.EDIT_PAVILIONS)
  delete(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.delete(storeId, id);
  }
}

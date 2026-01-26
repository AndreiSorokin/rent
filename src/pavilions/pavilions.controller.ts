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
import { Permission, Prisma } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('stores/:storeId/pavilions')
export class PavilionsController {
  constructor(private readonly service: PavilionsService) {}

  @Post()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  @Permissions(Permission.CREATE_PAVILIONS)
  create(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() data: Prisma.PavilionCreateInput,
  ) {
    return this.service.create(storeId, data);
  }

  @Get()
  @Permissions(Permission.VIEW_PAVILIONS)
  findAll(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.service.findAll(storeId);
  }

  @Get(':pavilionId')
  @Permissions(Permission.VIEW_PAVILIONS)
  findOne(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
  ) {
    return this.service.findOne(storeId, pavilionId);
  }

  @Patch(':pavilionId')
  @Permissions(Permission.EDIT_PAVILIONS)
  update(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Body() data: Prisma.PavilionUpdateInput,
  ) {
    return this.service.update(storeId, pavilionId, data);
  }

  @Delete(':pavilionId')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  @Permissions(Permission.DELETE_PAVILIONS)
  delete(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
  ) {
    return this.service.delete(storeId, pavilionId);
  }
}

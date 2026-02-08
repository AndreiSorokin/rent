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
import { CreateDiscountDto } from './dto/create-discount.dto';
import { DiscountsService } from './discounts.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('stores/:storeId/pavilions/:pavilionId/discounts')
export class DiscountsController {
  constructor(private readonly service: DiscountsService) {}

  @Get()
  @Permissions(Permission.VIEW_PAVILIONS)
  list(@Param('pavilionId', ParseIntPipe) pavilionId: number) {
    return this.service.list(pavilionId);
  }

  @Post()
  @Permissions(Permission.EDIT_PAVILIONS)
  create(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Body() dto: CreateDiscountDto,
  ) {
    return this.service.create(pavilionId, dto);
  }

  @Delete(':discountId')
  @Permissions(Permission.EDIT_PAVILIONS)
  delete(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('discountId', ParseIntPipe) discountId: number,
  ) {
    return this.service.delete(pavilionId, discountId);
  }
}

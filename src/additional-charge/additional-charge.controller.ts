import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { AdditionalChargeService } from './additional-charge.service';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('pavilions/:pavilionId/additional-charges')
export class AdditionalChargeController {
  constructor(private service: AdditionalChargeService) {}

  @Post()
  @Permissions(Permission.CREATE_CHARGES)
  create(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Body() data: { name: string; amount: number },
  ) {
    return this.service.create(pavilionId, data);
  }

  @Get()
  @Permissions(Permission.VIEW_CHARGES)
  findAll(@Param('pavilionId', ParseIntPipe) pavilionId: number) {
    return this.service.findAll(pavilionId);
  }

  @Patch(':chargeId')
  @Permissions(Permission.EDIT_CHARGES)
  update(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('chargeId', ParseIntPipe) chargeId: number,
    @Body() data: { name?: string; amount?: number },
  ) {
    return this.service.update(pavilionId, chargeId, data);
  }

  @Delete(':chargeId')
  @Permissions(Permission.DELETE_CHARGES)
  delete(
    @Param('pavilionId', ParseIntPipe) pavilionId: number,
    @Param('chargeId', ParseIntPipe) chargeId: number,
  ) {
    return this.service.delete(pavilionId, chargeId);
  }
}

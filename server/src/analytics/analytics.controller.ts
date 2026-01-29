import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('stores/:storeId/analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get()
  @Permissions(Permission.VIEW_PAYMENTS)
  get(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.service.getStoreAnalytics(storeId);
  }
}

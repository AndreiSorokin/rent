import {
  Controller,
  Post,
  Patch,
  Get,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { StoreUserService } from './store-user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('stores/:storeId/users')
export class StoreUserController {
  constructor(private service: StoreUserService) {}

  @Permissions(Permission.INVITE_USERS)
  @Post(':userId/invite')
  invite(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.service.inviteUser(storeId, userId);
  }

  @Permissions(Permission.ASSIGN_PERMISSIONS)
  @Patch(':userId/permissions')
  assignPermissions(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body('permissions') permissions: Permission[],
  ) {
    return this.service.assignPermissions(storeId, userId, permissions);
  }

  @Permissions(Permission.ASSIGN_PERMISSIONS)
  @Get()
  list(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.service.listUsers(storeId);
  }

  @Permissions(Permission.ASSIGN_PERMISSIONS)
  @Delete(':userId')
  remove(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.service.removeUser(storeId, userId);
  }
}

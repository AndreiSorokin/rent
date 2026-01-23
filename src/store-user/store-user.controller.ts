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
  constructor(private readonly service: StoreUserService) {}

  // Invite user to store
  @Post('invite')
  @Permissions(Permission.INVITE_USERS)
  invite(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body('userId', ParseIntPipe) userId: number,
  ) {
    return this.service.inviteUser(storeId, userId);
  }

  // Assign permissions
  @Patch(':userId/permissions')
  @Permissions(Permission.ASSIGN_PERMISSIONS)
  assignPermissions(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body('permissions') permissions: Permission[],
  ) {
    return this.service.assignPermissions(storeId, userId, permissions);
  }

  // List users in store
  @Get()
  @Permissions(Permission.VIEW_PAVILIONS)
  list(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.service.listUsers(storeId);
  }

  // Remove user
  @Delete(':userId')
  @Permissions(Permission.ASSIGN_PERMISSIONS)
  remove(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.service.removeUser(storeId, userId);
  }
}

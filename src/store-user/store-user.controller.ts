import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
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

  /**
   * Invite user to store (no permissions by default)
   */
  @Post(':userId/invite')
  @Permissions(Permission.ASSIGN_PERMISSIONS)
  inviteUser(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.service.inviteUser(storeId, userId);
  }

  //Assign and remove permissions
  @Put(':userId/permissions')
  @Permissions(Permission.ASSIGN_PERMISSIONS)
  setPermissions(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body('permissions') permissions: Permission[],
  ) {
    return this.service.setPermissions(storeId, userId, permissions);
  }

  @Get()
  listUsers(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.service.listUsers(storeId);
  }

  /**
   * Remove user from store
   */
  @Delete(':userId')
  @Permissions(Permission.ASSIGN_PERMISSIONS)
  removeUser(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.service.removeUser(storeId, userId);
  }
}

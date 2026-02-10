import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
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
   * Invite user to store by email (no permissions by default)
   */

  @Post('invite-by-email')
  @Permissions(Permission.INVITE_USERS || Permission.ASSIGN_PERMISSIONS)
  async inviteByEmail(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body('email') email: string,
  ) {
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('Valid email is required');
    }
    return this.service.inviteByEmail(storeId, email);
  }

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
    @Req() req: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const actorUserId = req.user.id;
    return this.service.setPermissions(storeId, userId, permissions, actorUserId);
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
    @Req() req: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const actorUserId = req.user.id;
    return this.service.removeUser(storeId, userId, actorUserId);
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Permission } from '@prisma/client';
import { StoreActivityService } from 'src/store-activity/store-activity.service';

@Injectable()
export class StoreUserService {
  constructor(
    private prisma: PrismaService,
    private readonly storeActivity: StoreActivityService,
  ) {}

  async inviteByEmail(storeId: number, email: string, actorUserId?: number) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException(`No user found with email: ${email}`);
    }

    // Check if already member
    const existing = await this.prisma.storeUser.findUnique({
      where: { userId_storeId: { userId: user.id, storeId } },
    });

    if (existing) {
      throw new BadRequestException('User is already a member of this store');
    }

    const created = await this.prisma.storeUser.create({
      data: {
        storeId,
        userId: user.id,
        permissions: [], // starts empty
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    await this.storeActivity.log({
      storeId,
      userId: actorUserId,
      action: 'CREATE',
      entityType: 'STORE_USER_INVITE',
      entityId: created.userId,
      details: {
        invitedUserId: created.userId,
        invitedUserEmail: created.user.email,
        invitedUserName: created.user.name,
      },
    });
    return created;
  }

  // Invite a user to a store (starts with empty permissions)
  async inviteUser(storeId: number, userId: number, actorUserId?: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const created = await this.prisma.storeUser.create({
      data: {
        storeId,
        userId,
        permissions: [], // empty by default
      },
    });
    await this.storeActivity.log({
      storeId,
      userId: actorUserId,
      action: 'CREATE',
      entityType: 'STORE_USER_INVITE',
      entityId: created.userId,
      details: {
        invitedUserId: created.userId,
        invitedUserEmail: user.email,
        invitedUserName: user.name,
      },
    });
    return created;
  }

  //Assign and remove permissions
  async setPermissions(
    storeId: number,
    userId: number,
    permissions: Permission[],
    actorUserId: number,
  ) {
    const actorStoreUser = await this.prisma.storeUser.findUnique({
      where: {
        userId_storeId: { userId: actorUserId, storeId },
      },
      select: { permissions: true },
    });

    if (!actorStoreUser) {
      throw new NotFoundException('Current user not part of this store');
    }

    if (
      actorUserId === userId &&
      actorStoreUser.permissions.includes(Permission.ASSIGN_PERMISSIONS)
    ) {
      throw new BadRequestException(
        'Store owner/admin cannot change own permissions',
      );
    }

    const storeUser = await this.prisma.storeUser.findUnique({
      where: {
        userId_storeId: { userId, storeId },
      },
    });

    if (!storeUser) {
      throw new NotFoundException('User not part of this store');
    }

    const updated = await this.prisma.storeUser.update({
      where: {
        userId_storeId: { userId, storeId },
      },
      data: {
        permissions,
      },
    });
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    await this.storeActivity.log({
      storeId,
      userId: actorUserId,
      action: 'UPDATE',
      entityType: 'STORE_USER_PERMISSIONS',
      entityId: userId,
      details: {
        targetUserId: userId,
        targetUserEmail: targetUser?.email ?? null,
        targetUserName: targetUser?.name ?? null,
        before: { permissions: storeUser.permissions },
        after: { permissions: permissions },
      },
    });
    return updated;
  }

  // List all users in a store with permissions
  async listUsers(storeId: number) {
    return this.prisma.storeUser.findMany({
      where: { storeId },
      include: {
        user: true,
      },
    });
  }

  // Remove a user from a store
  async removeUser(storeId: number, userId: number, actorUserId: number) {
    const actorStoreUser = await this.prisma.storeUser.findUnique({
      where: {
        userId_storeId: { userId: actorUserId, storeId },
      },
      select: { permissions: true },
    });

    if (!actorStoreUser) {
      throw new NotFoundException('Current user not part of this store');
    }

    if (
      actorUserId === userId &&
      actorStoreUser.permissions.includes(Permission.ASSIGN_PERMISSIONS)
    ) {
      throw new BadRequestException(
        'Store owner/admin cannot remove themselves from store',
      );
    }

    return this.prisma.storeUser.delete({
      where: {
        userId_storeId: { userId, storeId },
      },
    });
  }
}

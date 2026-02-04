import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Permission } from '@prisma/client';

@Injectable()
export class StoreUserService {
  constructor(private prisma: PrismaService) {}

  async inviteByEmail(storeId: number, email: string) {
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

    return this.prisma.storeUser.create({
      data: {
        storeId,
        userId: user.id,
        permissions: [], // starts empty
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  // Invite a user to a store (starts with empty permissions)
  async inviteUser(storeId: number, userId: number) {
    return this.prisma.storeUser.create({
      data: {
        storeId,
        userId,
        permissions: [], // empty by default
      },
    });
  }

  //Assign and remove permissions
  async setPermissions(
    storeId: number,
    userId: number,
    permissions: Permission[],
  ) {
    const storeUser = await this.prisma.storeUser.findUnique({
      where: {
        userId_storeId: { userId, storeId },
      },
    });

    if (!storeUser) {
      throw new NotFoundException('User not part of this store');
    }

    return this.prisma.storeUser.update({
      where: {
        userId_storeId: { userId, storeId },
      },
      data: {
        permissions,
      },
    });
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
  async removeUser(storeId: number, userId: number) {
    return this.prisma.storeUser.delete({
      where: {
        userId_storeId: { userId, storeId },
      },
    });
  }
}

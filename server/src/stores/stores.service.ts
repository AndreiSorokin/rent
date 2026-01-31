import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Permission, Prisma } from '@prisma/client';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all stores which belong to a specific owner
   */

  async findUserStores(userId: number) {
    return this.prisma.store.findMany({
      where: {
        storeUsers: {
          some: {
            userId: userId,
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
    });
  }

  /**
   * Create store + make creator store admin (all permissions)
   */
  async create(data: Prisma.StoreCreateInput, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data,
      });

      await tx.storeUser.create({
        data: {
          userId,
          storeId: store.id,
          permissions: Object.values(Permission),
        },
      });

      return store;
    });
  }

  /**
   * Get all stores current user belongs to
   */
  async findAll(userId: number) {
    return this.prisma.store.findMany({
      where: {
        storeUsers: {
          some: { userId },
        },
      },
      include: {
        storeUsers: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        pavilions: true,
      },
    });
  }

  /**
   * Get one store (only if user belongs to it)
   */
  async findOne(storeId: number, userId: number) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: {
        pavilions: true,
        storeUsers: {
          where: { userId },
          select: {
            permissions: true,
          },
        },
      },
    });

    if (!store || store.storeUsers.length === 0) {
      throw new ForbiddenException('No access to this store');
    }

    return {
      ...store,
      permissions: store.storeUsers[0].permissions,
    };
  }

  /**
   * Delete store (only if empty)
   */
  async delete(storeId: number, userId: number) {
    // Ensure store exists and user is owner/admin
    const storeUser = await this.prisma.storeUser.findUnique({
      where: {
        userId_storeId: { userId, storeId },
      },
    });

    if (!storeUser) {
      throw new NotFoundException('Store not found or access denied');
    }

    if (!storeUser.permissions.includes(Permission.ASSIGN_PERMISSIONS)) {
      throw new ForbiddenException('Only store admin can delete store');
    }

    // Ensure no pavilions exist
    const pavilionCount = await this.prisma.pavilion.count({
      where: { storeId },
    });

    if (pavilionCount > 0) {
      throw new BadRequestException(
        'Cannot delete store with existing pavilions',
      );
    }
    // Transaction: delete StoreUsers → delete Store
    return this.prisma.$transaction([
      this.prisma.storeUser.deleteMany({
        where: { storeId },
      }),
      this.prisma.store.delete({
        where: { id: storeId },
      }),
    ]);
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Currency, Permission, PavilionStatus, Prisma } from '@prisma/client';
import { startOfMonth } from 'date-fns';

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
    await this.prisma.pavilion.updateMany({
      where: {
        store: {
          storeUsers: {
            some: { userId },
          },
        },
        status: PavilionStatus.PREPAID,
        prepaidUntil: {
          lt: startOfMonth(new Date()),
        },
      },
      data: {
        status: PavilionStatus.RENTED,
        prepaidUntil: null,
      },
    });

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
    await this.prisma.pavilion.updateMany({
      where: {
        storeId,
        status: PavilionStatus.PREPAID,
        prepaidUntil: {
          lt: startOfMonth(new Date()),
        },
      },
      data: {
        status: PavilionStatus.RENTED,
        prepaidUntil: null,
      },
    });

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: {
        pavilions: {
          include: {
            payments: true,
            additionalCharges: {
              include: {
                payments: true,
              },
            },
            householdExpenses: true,
            discounts: true,
          },
        },
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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

  async updateCurrency(storeId: number, userId: number, currency: Currency) {
    const storeUser = await this.prisma.storeUser.findUnique({
      where: {
        userId_storeId: { userId, storeId },
      },
      select: { permissions: true },
    });

    if (!storeUser) {
      throw new NotFoundException('Store not found or access denied');
    }

    if (!storeUser.permissions.includes(Permission.ASSIGN_PERMISSIONS)) {
      throw new ForbiddenException('Only store owner can change currency');
    }

    return this.prisma.store.update({
      where: { id: storeId },
      data: { currency },
      select: { id: true, currency: true },
    });
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Currency, Permission, PavilionStatus, Prisma } from '@prisma/client';
import { endOfDay, startOfDay, startOfMonth, subMonths } from 'date-fns';

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
            discounts: true,
          },
        },
        storeUsers: {
          where: { userId },
          select: {
            permissions: true,
          },
        },
        staff: {
          orderBy: { createdAt: 'desc' },
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

  async createStaff(
    storeId: number,
    userId: number,
    data: { fullName: string; position: string },
  ) {
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
      throw new ForbiddenException('Only store owner can manage staff');
    }

    const fullName = data.fullName.trim();
    const position = data.position.trim();

    if (!fullName || !position) {
      throw new BadRequestException('fullName and position are required');
    }

    return this.prisma.storeStaff.create({
      data: {
        storeId,
        fullName,
        position,
      },
    });
  }

  async deleteStaff(storeId: number, staffId: number, userId: number) {
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
      throw new ForbiddenException('Only store owner can manage staff');
    }

    const staff = await this.prisma.storeStaff.findFirst({
      where: { id: staffId, storeId },
      select: { id: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff record not found');
    }

    return this.prisma.storeStaff.delete({
      where: { id: staffId },
    });
  }

  async listAccountingTable(storeId: number) {
    await this.cleanupOldAccountingRecords(storeId);

    const records = await this.prisma.storeAccountingRecord.findMany({
      where: { storeId },
      orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
    });

    return Promise.all(
      records.map(async (record) => {
        const dayStart = startOfDay(record.recordDate);
        const dayEnd = endOfDay(record.recordDate);

        const actual = await this.prisma.paymentTransaction.aggregate({
          where: {
            pavilion: { storeId },
            createdAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
          _sum: {
            bankTransferPaid: true,
            cashbox1Paid: true,
            cashbox2Paid: true,
          },
        });

        const actualBank = actual._sum.bankTransferPaid ?? 0;
        const actualCashbox1 = actual._sum.cashbox1Paid ?? 0;
        const actualCashbox2 = actual._sum.cashbox2Paid ?? 0;
        const actualTotal = actualBank + actualCashbox1 + actualCashbox2;
        const manualTotal =
          record.bankTransferPaid + record.cashbox1Paid + record.cashbox2Paid;

        return {
          ...record,
          manualTotal,
          actual: {
            bankTransferPaid: actualBank,
            cashbox1Paid: actualCashbox1,
            cashbox2Paid: actualCashbox2,
            total: actualTotal,
          },
          difference: manualTotal - actualTotal,
        };
      }),
    );
  }

  async createAccountingRecord(
    storeId: number,
    data: {
      recordDate: string;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    },
  ) {
    const parsedDate = new Date(data.recordDate);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Invalid recordDate');
    }

    const bankTransferPaid = Number(data.bankTransferPaid ?? 0);
    const cashbox1Paid = Number(data.cashbox1Paid ?? 0);
    const cashbox2Paid = Number(data.cashbox2Paid ?? 0);

    if (bankTransferPaid < 0 || cashbox1Paid < 0 || cashbox2Paid < 0) {
      throw new BadRequestException('Amounts must be non-negative');
    }

    await this.cleanupOldAccountingRecords(storeId);

    return this.prisma.storeAccountingRecord.create({
      data: {
        storeId,
        recordDate: startOfDay(parsedDate),
        bankTransferPaid,
        cashbox1Paid,
        cashbox2Paid,
      },
    });
  }

  async deleteAccountingRecord(storeId: number, recordId: number) {
    const record = await this.prisma.storeAccountingRecord.findFirst({
      where: { id: recordId, storeId },
      select: { id: true },
    });

    if (!record) {
      throw new NotFoundException('Accounting record not found');
    }

    return this.prisma.storeAccountingRecord.delete({
      where: { id: recordId },
    });
  }

  private async cleanupOldAccountingRecords(storeId: number) {
    const cutoff = startOfDay(subMonths(new Date(), 1));

    await this.prisma.storeAccountingRecord.deleteMany({
      where: {
        storeId,
        recordDate: {
          lt: cutoff,
        },
      },
    });
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Currency, Permission, PavilionStatus, Prisma } from '@prisma/client';
import { endOfDay, endOfMonth, startOfDay, startOfMonth, subMonths } from 'date-fns';

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
    data: { fullName: string; position: string; salary?: number },
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
    const salary = Number(data.salary ?? 0);

    if (!fullName || !position) {
      throw new BadRequestException('fullName and position are required');
    }
    if (Number.isNaN(salary) || salary < 0) {
      throw new BadRequestException('salary must be non-negative');
    }

    return this.prisma.storeStaff.create({
      data: {
        storeId,
        fullName,
        position,
        salary,
      },
    });
  }

  async updateStaff(
    storeId: number,
    staffId: number,
    userId: number,
    data: { salary?: number; salaryStatus?: 'UNPAID' | 'PAID' },
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

    if (
      !storeUser.permissions.includes(Permission.EDIT_CHARGES) &&
      !storeUser.permissions.includes(Permission.ASSIGN_PERMISSIONS)
    ) {
      throw new ForbiddenException('No permission to update salary status');
    }

    const staff = await this.prisma.storeStaff.findFirst({
      where: { id: staffId, storeId },
      select: { id: true },
    });
    if (!staff) {
      throw new NotFoundException('Staff record not found');
    }

    const updateData: Prisma.StoreStaffUpdateInput = {};
    if (data.salary !== undefined) {
      const salary = Number(data.salary);
      if (Number.isNaN(salary) || salary < 0) {
        throw new BadRequestException('salary must be non-negative');
      }
      updateData.salary = salary;
    }
    if (data.salaryStatus !== undefined) {
      updateData.salaryStatus = data.salaryStatus;
    }

    return this.prisma.storeStaff.update({
      where: { id: staffId },
      data: updateData,
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

  async updateExpenseStatuses(
    storeId: number,
    userId: number,
    data: {
      utilitiesExpenseStatus?: 'UNPAID' | 'PAID';
      householdExpenseStatus?: 'UNPAID' | 'PAID';
    },
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

    if (
      !storeUser.permissions.includes(Permission.EDIT_CHARGES) &&
      !storeUser.permissions.includes(Permission.ASSIGN_PERMISSIONS)
    ) {
      throw new ForbiddenException('No permission to manage expense statuses');
    }

    return this.prisma.store.update({
      where: { id: storeId },
      data: {
        utilitiesExpenseStatus: data.utilitiesExpenseStatus,
        householdExpenseStatus: data.householdExpenseStatus,
      },
      select: {
        id: true,
        utilitiesExpenseStatus: true,
        householdExpenseStatus: true,
      },
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

  async importData(
    storeId: number,
    userId: number,
    data: {
      pavilions?: Array<{
        number: string;
        category?: string | null;
        squareMeters: number;
        pricePerSqM: number;
        status?: 'AVAILABLE' | 'RENTED' | 'PREPAID';
        tenantName?: string | null;
        utilitiesAmount?: number | null;
      }>;
      householdExpenses?: Array<{
        name: string;
        amount: number;
        status?: 'UNPAID' | 'PAID';
      }>;
      expenses?: Array<{
        type:
          | 'PAYROLL_TAX'
          | 'PROFIT_TAX'
          | 'DIVIDENDS'
          | 'BANK_SERVICES'
          | 'VAT'
          | 'LAND_RENT'
          | 'OTHER';
        amount: number;
        status?: 'UNPAID' | 'PAID';
        note?: string | null;
      }>;
      accounting?: Array<{
        recordDate: string;
        bankTransferPaid?: number;
        cashbox1Paid?: number;
        cashbox2Paid?: number;
      }>;
      staff?: Array<{
        fullName: string;
        position: string;
        salary?: number;
        salaryStatus?: 'UNPAID' | 'PAID';
      }>;
    },
  ) {
    const storeUser = await this.prisma.storeUser.findUnique({
      where: { userId_storeId: { userId, storeId } },
      select: { permissions: true },
    });

    if (!storeUser) {
      throw new NotFoundException('Store not found or access denied');
    }
    if (!storeUser.permissions.includes(Permission.ASSIGN_PERMISSIONS)) {
      throw new ForbiddenException('Only store owner can import data');
    }

    return this.prisma.$transaction(async (tx) => {
      const existingPavilions = await tx.pavilion.findMany({
        where: { storeId },
        select: { id: true, number: true },
      });
      const pavilionByNumber = new Map(
        existingPavilions.map((p) => [p.number.trim().toLowerCase(), p]),
      );

      let importedPavilions = 0;
      let importedHousehold = 0;
      let importedExpenses = 0;
      let importedAccounting = 0;
      let importedStaff = 0;

      for (const item of data.pavilions ?? []) {
        const number = item.number?.trim();
        if (!number) continue;
        const normalizedNumber = number.toLowerCase();
        if (
          normalizedNumber.includes('итог') ||
          normalizedNumber.includes('всего') ||
          normalizedNumber.includes('total') ||
          normalizedNumber.includes('sum')
        ) {
          continue;
        }

        const squareMeters = Number(item.squareMeters);
        const pricePerSqM = Number(item.pricePerSqM);
        if (Number.isNaN(squareMeters) || Number.isNaN(pricePerSqM)) continue;

        const normalizedStatus =
          item.status === 'RENTED' || item.status === 'PREPAID'
            ? item.status
            : PavilionStatus.AVAILABLE;
        const key = normalizedNumber;
        const rentAmount = squareMeters * pricePerSqM;

        const baseData = {
          number,
          category: item.category ?? null,
          squareMeters,
          pricePerSqM,
          rentAmount,
          status: normalizedStatus,
          tenantName:
            normalizedStatus === PavilionStatus.AVAILABLE
              ? null
              : (item.tenantName ?? null),
          utilitiesAmount: item.utilitiesAmount ?? null,
          prepaidUntil:
            normalizedStatus === PavilionStatus.PREPAID
              ? endOfMonth(new Date())
              : null,
        };

        const existing = pavilionByNumber.get(key);
        if (existing) {
          await tx.pavilion.update({
            where: { id: existing.id },
            data: baseData,
          });
        } else {
          const created = await tx.pavilion.create({
            data: {
              ...baseData,
              storeId,
            },
          });
          pavilionByNumber.set(key, { id: created.id, number: created.number });
        }
        importedPavilions += 1;
      }

      for (const item of data.householdExpenses ?? []) {
        const name = item.name?.trim();
        const amount = Number(item.amount);
        if (!name || Number.isNaN(amount)) continue;

        await tx.householdExpense.create({
          data: {
            storeId,
            name,
            amount,
            status: item.status ?? 'UNPAID',
          },
        });
        importedHousehold += 1;
      }

      for (const item of data.expenses ?? []) {
        const amount = Number(item.amount);
        if (Number.isNaN(amount)) continue;
        await tx.pavilionExpense.create({
          data: {
            storeId,
            type: item.type,
            amount,
            status: item.status ?? 'UNPAID',
            note: item.note ?? null,
          },
        });
        importedExpenses += 1;
      }

      for (const item of data.accounting ?? []) {
        const parsedDate = new Date(item.recordDate);
        if (Number.isNaN(parsedDate.getTime())) continue;
        await tx.storeAccountingRecord.create({
          data: {
            storeId,
            recordDate: startOfDay(parsedDate),
            bankTransferPaid: Number(item.bankTransferPaid ?? 0),
            cashbox1Paid: Number(item.cashbox1Paid ?? 0),
            cashbox2Paid: Number(item.cashbox2Paid ?? 0),
          },
        });
        importedAccounting += 1;
      }

      for (const item of data.staff ?? []) {
        const fullName = item.fullName?.trim();
        const position = item.position?.trim();
        const salary = Number(item.salary ?? 0);
        if (!fullName || !position || Number.isNaN(salary)) continue;

        await tx.storeStaff.create({
          data: {
            storeId,
            fullName,
            position,
            salary,
            salaryStatus: item.salaryStatus ?? 'UNPAID',
          },
        });
        importedStaff += 1;
      }

      return {
        imported: {
          pavilions: importedPavilions,
          householdExpenses: importedHousehold,
          expenses: importedExpenses,
          accounting: importedAccounting,
          staff: importedStaff,
        },
      };
    });
  }
}

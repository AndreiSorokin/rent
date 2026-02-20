import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Currency, Permission, PavilionStatus, Prisma } from '@prisma/client';
import { endOfDay, endOfMonth, startOfDay, startOfMonth, subMonths } from 'date-fns';

@Injectable()
export class StoresService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly prisma: PrismaService) {}
  private readonly logger = new Logger(StoresService.name);
  private monthlyRolloverTimer?: NodeJS.Timeout;

  onModuleInit() {
    void this.runMonthlyRolloverForAllStores();
    this.monthlyRolloverTimer = setInterval(() => {
      void this.runMonthlyRolloverForAllStores();
    }, 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.monthlyRolloverTimer) {
      clearInterval(this.monthlyRolloverTimer);
      this.monthlyRolloverTimer = undefined;
    }
  }

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
    const memberships = await this.prisma.storeUser.findMany({
      where: { userId },
      select: { storeId: true },
    });
    await Promise.all(
      memberships.map((membership) =>
        this.runMonthlyRolloverForStore(membership.storeId),
      ),
    );

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
    await this.runMonthlyRolloverForStore(storeId);

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
            groupMemberships: {
              include: {
                group: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        pavilionGroups: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: {
            pavilions: {
              select: {
                pavilionId: true,
              },
            },
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
   * Delete store with all related data
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

    // Cascade-like delete flow for store-owned data
    // Transaction: delete StoreUsers → delete Store
    await this.prisma.$transaction(async (tx) => {
      await tx.invitation.deleteMany({
        where: { storeId },
      });
      await tx.storeUser.deleteMany({
        where: { storeId },
      });
      await tx.pavilion.deleteMany({
        where: { storeId },
      });
      await tx.store.delete({
        where: { id: storeId },
      });
    });

    return { success: true };
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

  async updateName(storeId: number, userId: number, name: string) {
    await this.assertStorePermission(storeId, userId, [Permission.ASSIGN_PERMISSIONS]);

    const normalizedName = name?.trim();
    if (!normalizedName) {
      throw new BadRequestException('Store name is required');
    }

    return this.prisma.store.update({
      where: { id: storeId },
      data: { name: normalizedName },
      select: { id: true, name: true },
    });
  }

  async addPavilionCategory(storeId: number, userId: number, name: string) {
    await this.assertStorePermission(storeId, userId, [
      Permission.EDIT_PAVILIONS,
      Permission.ASSIGN_PERMISSIONS,
    ]);

    const normalizedName = name?.trim();
    if (!normalizedName) {
      throw new BadRequestException('Category name is required');
    }

    const store = (await (this.prisma.store as any).findUnique({
      where: { id: storeId },
      select: { pavilionCategoryPresets: true },
    })) as { pavilionCategoryPresets?: string[] } | null;
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const unique = Array.from(
      new Set([...(store.pavilionCategoryPresets ?? []), normalizedName]),
    );

    return (this.prisma.store as any).update({
      where: { id: storeId },
      data: { pavilionCategoryPresets: unique },
      select: { id: true, pavilionCategoryPresets: true },
    });
  }

  async renamePavilionCategory(
    storeId: number,
    userId: number,
    oldName: string,
    newName: string,
  ) {
    await this.assertStorePermission(storeId, userId, [
      Permission.EDIT_PAVILIONS,
      Permission.ASSIGN_PERMISSIONS,
    ]);

    const normalizedOldName = decodeURIComponent(oldName ?? '').trim();
    const normalizedNewName = newName?.trim();
    if (!normalizedOldName || !normalizedNewName) {
      throw new BadRequestException('Both old and new category names are required');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.pavilion.updateMany({
        where: { storeId, category: normalizedOldName },
        data: { category: normalizedNewName },
      });

      const store = (await (tx.store as any).findUnique({
        where: { id: storeId },
        select: { pavilionCategoryPresets: true },
      })) as { pavilionCategoryPresets?: string[] } | null;
      if (!store) {
        throw new NotFoundException('Store not found');
      }

      const updatedPresets = Array.from(
        new Set(
          (store.pavilionCategoryPresets ?? []).map((category) =>
            category === normalizedOldName ? normalizedNewName : category,
          ),
        ),
      );

      return (tx.store as any).update({
        where: { id: storeId },
        data: { pavilionCategoryPresets: updatedPresets },
        select: { id: true, pavilionCategoryPresets: true },
      });
    });
  }

  async deletePavilionCategory(storeId: number, userId: number, name: string) {
    await this.assertStorePermission(storeId, userId, [
      Permission.EDIT_PAVILIONS,
      Permission.ASSIGN_PERMISSIONS,
    ]);

    const normalizedName = decodeURIComponent(name ?? '').trim();
    if (!normalizedName) {
      throw new BadRequestException('Category name is required');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.pavilion.updateMany({
        where: { storeId, category: normalizedName },
        data: { category: null },
      });

      const store = (await (tx.store as any).findUnique({
        where: { id: storeId },
        select: { pavilionCategoryPresets: true },
      })) as { pavilionCategoryPresets?: string[] } | null;
      if (!store) {
        throw new NotFoundException('Store not found');
      }

      const updatedPresets = (store.pavilionCategoryPresets ?? []).filter(
        (category) => category !== normalizedName,
      );

      return (tx.store as any).update({
        where: { id: storeId },
        data: { pavilionCategoryPresets: updatedPresets },
        select: { id: true, pavilionCategoryPresets: true },
      });
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

  async createPavilionGroup(
    storeId: number,
    userId: number,
    data: { name: string },
  ) {
    await this.assertStorePermission(storeId, userId, [
      Permission.EDIT_PAVILIONS,
      Permission.ASSIGN_PERMISSIONS,
    ]);

    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestException('Group name is required');
    }

    return this.prisma.pavilionGroup.create({
      data: {
        storeId,
        name,
      },
    });
  }

  async addPavilionToGroup(
    storeId: number,
    pavilionId: number,
    groupId: number,
    userId: number,
  ) {
    await this.assertStorePermission(storeId, userId, [
      Permission.EDIT_PAVILIONS,
      Permission.ASSIGN_PERMISSIONS,
    ]);

    const pavilion = await this.prisma.pavilion.findFirst({
      where: { id: pavilionId, storeId },
      select: { id: true },
    });
    if (!pavilion) {
      throw new NotFoundException('Pavilion not found');
    }

    const group = await this.prisma.pavilionGroup.findFirst({
      where: { id: groupId, storeId },
      select: { id: true },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return this.prisma.pavilionGroupMembership.upsert({
      where: {
        groupId_pavilionId: {
          groupId,
          pavilionId,
        },
      },
      create: {
        groupId,
        pavilionId,
      },
      update: {},
    });
  }

  async renamePavilionGroup(
    storeId: number,
    groupId: number,
    userId: number,
    data: { name: string },
  ) {
    await this.assertStorePermission(storeId, userId, [
      Permission.EDIT_PAVILIONS,
      Permission.ASSIGN_PERMISSIONS,
    ]);

    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestException('Group name is required');
    }

    const group = await this.prisma.pavilionGroup.findFirst({
      where: { id: groupId, storeId },
      select: { id: true },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return this.prisma.pavilionGroup.update({
      where: { id: groupId },
      data: { name },
    });
  }

  async deletePavilionGroup(storeId: number, groupId: number, userId: number) {
    await this.assertStorePermission(storeId, userId, [
      Permission.EDIT_PAVILIONS,
      Permission.ASSIGN_PERMISSIONS,
    ]);

    const group = await this.prisma.pavilionGroup.findFirst({
      where: { id: groupId, storeId },
      select: { id: true },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return this.prisma.pavilionGroup.delete({
      where: { id: groupId },
    });
  }

  async removePavilionFromGroup(
    storeId: number,
    pavilionId: number,
    groupId: number,
    userId: number,
  ) {
    await this.assertStorePermission(storeId, userId, [
      Permission.EDIT_PAVILIONS,
      Permission.ASSIGN_PERMISSIONS,
    ]);

    const group = await this.prisma.pavilionGroup.findFirst({
      where: { id: groupId, storeId },
      select: { id: true },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const membership = await this.prisma.pavilionGroupMembership.findUnique({
      where: {
        groupId_pavilionId: {
          groupId,
          pavilionId,
        },
      },
      select: { groupId: true, pavilionId: true },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    return this.prisma.pavilionGroupMembership.delete({
      where: {
        groupId_pavilionId: {
          groupId,
          pavilionId,
        },
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
        advertisingAmount?: number | null;
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
      const currentPeriod = startOfMonth(new Date());

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

        const hasTenantName = Boolean(item.tenantName?.trim());
        const hasUtilities = Number(item.utilitiesAmount ?? 0) > 0;
        const hasAdvertising = Number(item.advertisingAmount ?? 0) > 0;
        const normalizedStatus =
          item.status === 'RENTED' || item.status === 'PREPAID'
            ? item.status
            : hasTenantName || hasUtilities || hasAdvertising
              ? PavilionStatus.RENTED
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
          utilitiesAmount:
            normalizedStatus === PavilionStatus.AVAILABLE
              ? null
              : normalizedStatus === PavilionStatus.PREPAID
                ? 0
                : (item.utilitiesAmount ?? 0),
          advertisingAmount:
            normalizedStatus === PavilionStatus.AVAILABLE
              ? null
              : normalizedStatus === PavilionStatus.PREPAID
                ? 0
                : (item.advertisingAmount ?? 0),
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
          await tx.pavilionMonthlyLedger.deleteMany({
            where: {
              pavilionId: existing.id,
              period: currentPeriod,
            },
          });
        } else {
          const created = await tx.pavilion.create({
            data: {
              ...baseData,
              storeId,
            },
          });
          pavilionByNumber.set(key, { id: created.id, number: created.number });
          await tx.pavilionMonthlyLedger.deleteMany({
            where: {
              pavilionId: created.id,
              period: currentPeriod,
            },
          });
        }
        importedPavilions += 1;
      }

      for (const item of data.householdExpenses ?? []) {
        const name = item.name?.trim();
        const amount = Number(item.amount);
        if (!name || Number.isNaN(amount)) continue;

        await tx.pavilionExpense.create({
          data: {
            storeId,
            type: 'HOUSEHOLD' as any,
            note: name,
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

      // Treat imported data as the active baseline for the current month.
      // This prevents immediate monthly rollover from clearing imported utilities/advertising.
      await tx.store.update({
        where: { id: storeId },
        data: {
          lastMonthlyResetPeriod: currentPeriod,
        },
      });

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

  private getMonthlyDiscountTotal(
    discounts: Array<{ amount: number; startsAt: Date; endsAt: Date | null }>,
    squareMeters: number,
    period: Date,
  ) {
    const monthStart = startOfMonth(period);
    const monthEnd = endOfMonth(period);

    return discounts.reduce((sum, discount) => {
      const startsBeforeMonthEnds = discount.startsAt <= monthEnd;
      const endsAfterMonthStarts =
        discount.endsAt === null || discount.endsAt >= monthStart;
      if (startsBeforeMonthEnds && endsAfterMonthStarts) {
        return sum + discount.amount * squareMeters;
      }
      return sum;
    }, 0);
  }

  private async runMonthlyRolloverForStore(storeId: number) {
    const currentPeriod = startOfMonth(new Date());
    const previousPeriod = startOfMonth(subMonths(currentPeriod, 1));
    const previousPeriodStart = startOfMonth(previousPeriod);
    const previousPeriodEnd = endOfMonth(previousPeriod);

    // Always keep PREPAID state up to date.
    await this.prisma.pavilion.updateMany({
      where: {
        storeId,
        status: PavilionStatus.PREPAID,
        prepaidUntil: {
          lt: currentPeriod,
        },
      },
      data: {
        status: PavilionStatus.RENTED,
        prepaidUntil: null,
      },
    });

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        lastMonthlyResetPeriod: true,
      },
    });
    if (!store) return;

    const alreadyResetThisMonth =
      store.lastMonthlyResetPeriod &&
      startOfMonth(store.lastMonthlyResetPeriod).getTime() === currentPeriod.getTime();
    if (alreadyResetThisMonth) return;

    const pavilions = await this.prisma.pavilion.findMany({
      where: { storeId },
      include: {
        discounts: true,
        payments: {
          where: { period: previousPeriod },
        },
        additionalCharges: {
          where: {
            createdAt: {
              gte: previousPeriodStart,
              lte: previousPeriodEnd,
            },
          },
          include: {
            payments: {
              where: {
                paidAt: {
                  gte: previousPeriodStart,
                  lte: previousPeriodEnd,
                },
              },
            },
          },
        },
        monthlyLedgers: {
          orderBy: { period: 'desc' },
          take: 1,
        },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const pavilion of pavilions) {
        const openingDebt = pavilion.monthlyLedgers[0]?.closingDebt ?? 0;
        const baseRent = pavilion.squareMeters * pavilion.pricePerSqM;
        const discount =
          pavilion.status === PavilionStatus.PREPAID
            ? 0
            : this.getMonthlyDiscountTotal(
                pavilion.discounts,
                pavilion.squareMeters,
                previousPeriod,
              );
        const expectedRent =
          pavilion.status === PavilionStatus.PREPAID
            ? baseRent
            : pavilion.status === PavilionStatus.RENTED
              ? Math.max(baseRent - discount, 0)
              : 0;
        const expectedUtilities =
          pavilion.status === PavilionStatus.RENTED ? (pavilion.utilitiesAmount ?? 0) : 0;
        const expectedAdvertising =
          pavilion.status === PavilionStatus.RENTED ? (pavilion.advertisingAmount ?? 0) : 0;
        const expectedAdditional =
          pavilion.status === PavilionStatus.RENTED
            ? pavilion.additionalCharges.reduce((sum, charge) => sum + charge.amount, 0)
            : 0;
        const expectedTotal =
          expectedRent + expectedUtilities + expectedAdvertising + expectedAdditional;

        const actualRentAndUtilities = pavilion.payments.reduce(
          (sum, payment) =>
            sum +
            Number(payment.rentPaid ?? 0) +
            Number(payment.utilitiesPaid ?? 0) +
            Number(payment.advertisingPaid ?? 0),
          0,
        );
        const actualAdditional = pavilion.additionalCharges.reduce(
          (sum, charge) =>
            sum +
            charge.payments.reduce(
              (paymentSum, payment) => paymentSum + Number(payment.amountPaid ?? 0),
              0,
            ),
          0,
        );
        const actualTotal = actualRentAndUtilities + actualAdditional;
        const monthDelta = expectedTotal - actualTotal;
        const closingDebt = openingDebt + monthDelta;

        await tx.pavilionMonthlyLedger.upsert({
          where: {
            pavilionId_period: {
              pavilionId: pavilion.id,
              period: previousPeriod,
            },
          },
          update: {
            expectedRent,
            expectedUtilities,
            expectedAdvertising,
            expectedAdditional,
            expectedTotal,
            actualTotal,
            openingDebt,
            monthDelta,
            closingDebt,
          },
          create: {
            pavilionId: pavilion.id,
            period: previousPeriod,
            expectedRent,
            expectedUtilities,
            expectedAdvertising,
            expectedAdditional,
            expectedTotal,
            actualTotal,
            openingDebt,
            monthDelta,
            closingDebt,
          },
        });
      }

      await tx.pavilion.updateMany({
        where: {
          storeId,
          status: PavilionStatus.RENTED,
        },
        data: {
          utilitiesAmount: null,
          advertisingAmount: null,
        },
      });

      await tx.pavilion.updateMany({
        where: {
          storeId,
          status: PavilionStatus.PREPAID,
        },
        data: {
          utilitiesAmount: 0,
          advertisingAmount: 0,
        },
      });

      await tx.store.update({
        where: { id: storeId },
        data: {
          utilitiesExpenseStatus: 'UNPAID',
          householdExpenseStatus: 'UNPAID',
          lastMonthlyResetPeriod: currentPeriod,
        },
      });
    });
  }

  private async runMonthlyRolloverForAllStores() {
    try {
      const stores = await this.prisma.store.findMany({
        select: { id: true },
      });
      await Promise.all(
        stores.map((store) => this.runMonthlyRolloverForStore(store.id)),
      );
    } catch (error) {
      this.logger.error('Failed to execute monthly rollover job', error as Error);
    }
  }

  private async assertStorePermission(
    storeId: number,
    userId: number,
    required: Permission[],
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

    const allowed = required.some((permission) =>
      storeUser.permissions.includes(permission),
    );
    if (!allowed) {
      throw new ForbiddenException('No permission for this action');
    }
  }
}

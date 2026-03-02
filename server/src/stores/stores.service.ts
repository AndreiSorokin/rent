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
import {
  Currency,
  Permission,
  PavilionExpenseType,
  PavilionStatus,
  Prisma,
} from '@prisma/client';
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
  async findOne(
    storeId: number,
    userId: number,
    options?: { lite?: boolean },
  ) {
    await this.runMonthlyRolloverForStore(storeId);

    const include: Prisma.StoreInclude = {
      ...(options?.lite
        ? {}
        : {
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
          }),
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
    };

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include,
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

    if (
      !storeUser.permissions.includes(Permission.MANAGE_STAFF) &&
      !storeUser.permissions.includes(Permission.ASSIGN_PERMISSIONS)
    ) {
      throw new ForbiddenException('No permission to manage staff');
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
    data: {
      salary?: number;
      salaryStatus?: 'UNPAID' | 'PAID';
      salaryPaymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2';
      salaryBankTransferPaid?: number;
      salaryCashbox1Paid?: number;
      salaryCashbox2Paid?: number;
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
      !storeUser.permissions.includes(Permission.MANAGE_STAFF) &&
      !storeUser.permissions.includes(Permission.ASSIGN_PERMISSIONS)
    ) {
      throw new ForbiddenException('No permission to manage staff');
    }

    const staff = await (this.prisma.storeStaff as any).findFirst({
      where: { id: staffId, storeId },
      select: {
        id: true,
        salary: true,
        salaryStatus: true,
        salaryPaymentMethod: true,
        salaryBankTransferPaid: true,
        salaryCashbox1Paid: true,
        salaryCashbox2Paid: true,
      },
    });
    if (!staff) {
      throw new NotFoundException('Staff record not found');
    }

    const updateData: any = {};
    if (data.salary !== undefined) {
      const salary = Number(data.salary);
      if (Number.isNaN(salary) || salary < 0) {
        throw new BadRequestException('salary must be non-negative');
      }
      updateData.salary = salary;
    }
    if (
      data.salaryPaymentMethod !== undefined &&
      data.salaryPaymentMethod !== 'BANK_TRANSFER' &&
      data.salaryPaymentMethod !== 'CASHBOX1' &&
      data.salaryPaymentMethod !== 'CASHBOX2'
    ) {
      throw new BadRequestException('Invalid salaryPaymentMethod');
    }

    const deriveSingleMethod = (
      bankTransferPaid: number,
      cashbox1Paid: number,
      cashbox2Paid: number,
    ): 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2' | null => {
      const nonZero = [
        bankTransferPaid > 0,
        cashbox1Paid > 0,
        cashbox2Paid > 0,
      ].filter(Boolean).length;
      if (nonZero !== 1) return null;
      if (bankTransferPaid > 0) return 'BANK_TRANSFER';
      if (cashbox1Paid > 0) return 'CASHBOX1';
      if (cashbox2Paid > 0) return 'CASHBOX2';
      return null;
    };

    const effectiveSalaryAmount = Number(
      data.salary !== undefined ? data.salary : staff.salary ?? 0,
    );
    const hasAnySalaryChannelsInput =
      data.salaryBankTransferPaid !== undefined ||
      data.salaryCashbox1Paid !== undefined ||
      data.salaryCashbox2Paid !== undefined;
    const requestedStatus =
      data.salaryStatus ?? (hasAnySalaryChannelsInput ? 'PAID' : staff.salaryStatus);

    if (requestedStatus === 'UNPAID') {
      updateData.salaryStatus = 'UNPAID';
      updateData.salaryPaymentMethod = null;
      updateData.salaryBankTransferPaid = 0;
      updateData.salaryCashbox1Paid = 0;
      updateData.salaryCashbox2Paid = 0;
    } else {
      const bankTransferPaid = Number(
        data.salaryBankTransferPaid !== undefined
          ? data.salaryBankTransferPaid
          : staff.salaryBankTransferPaid ?? 0,
      );
      const cashbox1Paid = Number(
        data.salaryCashbox1Paid !== undefined
          ? data.salaryCashbox1Paid
          : staff.salaryCashbox1Paid ?? 0,
      );
      const cashbox2Paid = Number(
        data.salaryCashbox2Paid !== undefined
          ? data.salaryCashbox2Paid
          : staff.salaryCashbox2Paid ?? 0,
      );
      const channelsTotal = bankTransferPaid + cashbox1Paid + cashbox2Paid;
      const hasAnyPaidChannels = channelsTotal > 0;

      if (
        Number.isNaN(bankTransferPaid) ||
        Number.isNaN(cashbox1Paid) ||
        Number.isNaN(cashbox2Paid) ||
        bankTransferPaid < 0 ||
        cashbox1Paid < 0 ||
        cashbox2Paid < 0
      ) {
        throw new BadRequestException('Salary payment channels must be non-negative');
      }

      let nextBank = bankTransferPaid;
      let nextCash1 = cashbox1Paid;
      let nextCash2 = cashbox2Paid;
      if (!hasAnyPaidChannels) {
        const method =
          data.salaryPaymentMethod ?? staff.salaryPaymentMethod ?? 'BANK_TRANSFER';
        nextBank = method === 'BANK_TRANSFER' ? effectiveSalaryAmount : 0;
        nextCash1 = method === 'CASHBOX1' ? effectiveSalaryAmount : 0;
        nextCash2 = method === 'CASHBOX2' ? effectiveSalaryAmount : 0;
      }

      const nextChannelsTotal = nextBank + nextCash1 + nextCash2;
      if (Math.abs(nextChannelsTotal - effectiveSalaryAmount) > 0.01) {
        throw new BadRequestException(
          'Salary amount must equal selected payment channels total',
        );
      }

      updateData.salaryStatus = 'PAID';
      updateData.salaryBankTransferPaid = nextBank;
      updateData.salaryCashbox1Paid = nextCash1;
      updateData.salaryCashbox2Paid = nextCash2;
      updateData.salaryPaymentMethod = deriveSingleMethod(nextBank, nextCash1, nextCash2);
    }

    const updatedStaff = await (this.prisma.storeStaff as any).update({
      where: { id: staffId },
      data: updateData,
    });

    // Track salary payment as a month-bound expense entry so analytics can
    // calculate previous-month balance from historical data instead of current staff status.
    const currentMonthStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(new Date());
    const staffMonthExpenseNote = `STAFF:${staffId}:${currentMonthStart.toISOString()}`;

    const existingSalaryExpense = await this.prisma.pavilionExpense.findFirst({
      where: {
        storeId,
        type: PavilionExpenseType.SALARIES,
        note: staffMonthExpenseNote,
        createdAt: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
      },
      orderBy: { id: 'desc' },
      select: { id: true },
    });

    const effectiveSalaryStatus = data.salaryStatus ?? updatedStaff.salaryStatus;
    const effectiveSalaryAmountForExpense = Number(updatedStaff.salary ?? 0);
    const effectiveSalaryPaymentMethod =
      effectiveSalaryStatus === 'PAID'
        ? updatedStaff.salaryPaymentMethod ?? null
        : null;

    if (effectiveSalaryStatus === 'PAID') {
      if (existingSalaryExpense) {
        await this.prisma.pavilionExpense.update({
          where: { id: existingSalaryExpense.id },
          data: {
            amount: effectiveSalaryAmountForExpense,
            status: 'PAID',
            note: staffMonthExpenseNote,
            paymentMethod: effectiveSalaryPaymentMethod,
            bankTransferPaid: Number(updatedStaff.salaryBankTransferPaid ?? 0),
            cashbox1Paid: Number(updatedStaff.salaryCashbox1Paid ?? 0),
            cashbox2Paid: Number(updatedStaff.salaryCashbox2Paid ?? 0),
          },
        });
      } else {
        await this.prisma.pavilionExpense.create({
          data: {
            storeId,
            type: PavilionExpenseType.SALARIES,
            status: 'PAID',
            amount: effectiveSalaryAmountForExpense,
            note: staffMonthExpenseNote,
            paymentMethod: effectiveSalaryPaymentMethod,
            bankTransferPaid: Number(updatedStaff.salaryBankTransferPaid ?? 0),
            cashbox1Paid: Number(updatedStaff.salaryCashbox1Paid ?? 0),
            cashbox2Paid: Number(updatedStaff.salaryCashbox2Paid ?? 0),
          },
        });
      }
    } else if (existingSalaryExpense) {
      await this.prisma.pavilionExpense.delete({
        where: { id: existingSalaryExpense.id },
      });
    }

    return updatedStaff;
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

    if (
      !storeUser.permissions.includes(Permission.MANAGE_STAFF) &&
      !storeUser.permissions.includes(Permission.ASSIGN_PERMISSIONS)
    ) {
      throw new ForbiddenException('No permission to manage staff');
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

  private parseMonthPeriod(period?: string) {
    if (!period) {
      return startOfMonth(new Date());
    }

    const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
    if (!match) {
      throw new BadRequestException('period must be in YYYY-MM format');
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('period must be in YYYY-MM format');
    }

    return startOfMonth(new Date(year, month - 1, 1));
  }

  private normalizeExtraIncomeInput(data: {
    name?: string;
    amount?: number;
    bankTransferPaid?: number;
    cashbox1Paid?: number;
    cashbox2Paid?: number;
    period?: string;
    paidAt?: string;
  }) {
    const name = String(data.name ?? '').trim();
    const amount = Number(data.amount ?? 0);
    const bankTransferPaid = Number(data.bankTransferPaid ?? 0);
    const cashbox1Paid = Number(data.cashbox1Paid ?? 0);
    const cashbox2Paid = Number(data.cashbox2Paid ?? 0);
    const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();
    const period = this.parseMonthPeriod(data.period);

    if (!name) {
      throw new BadRequestException('name is required');
    }
    if (
      Number.isNaN(amount) ||
      Number.isNaN(bankTransferPaid) ||
      Number.isNaN(cashbox1Paid) ||
      Number.isNaN(cashbox2Paid) ||
      amount < 0 ||
      bankTransferPaid < 0 ||
      cashbox1Paid < 0 ||
      cashbox2Paid < 0
    ) {
      throw new BadRequestException('Amounts must be non-negative');
    }
    if (Number.isNaN(paidAt.getTime())) {
      throw new BadRequestException('Invalid paidAt');
    }
    const channelsTotal = bankTransferPaid + cashbox1Paid + cashbox2Paid;
    if (Math.abs(amount - channelsTotal) > 0.01) {
      throw new BadRequestException(
        'Amount must equal sum of payment channels',
      );
    }

    return {
      name,
      amount,
      bankTransferPaid,
      cashbox1Paid,
      cashbox2Paid,
      period,
      paidAt,
    };
  }

  async listStoreExtraIncome(storeId: number, period?: string) {
    const normalizedPeriod = this.parseMonthPeriod(period);
    return (this.prisma as any).storeExtraIncome.findMany({
      where: {
        storeId,
        period: normalizedPeriod,
      },
      orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
    });
  }

  async createStoreExtraIncome(
    storeId: number,
    data: {
      name: string;
      amount: number;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
      period?: string;
      paidAt?: string;
    },
  ) {
    const payload = this.normalizeExtraIncomeInput(data);
    return (this.prisma as any).storeExtraIncome.create({
      data: {
        storeId,
        name: payload.name,
        amount: payload.amount,
        bankTransferPaid: payload.bankTransferPaid,
        cashbox1Paid: payload.cashbox1Paid,
        cashbox2Paid: payload.cashbox2Paid,
        period: payload.period,
        paidAt: payload.paidAt,
      },
    });
  }

  async updateStoreExtraIncome(
    storeId: number,
    incomeId: number,
    data: {
      name?: string;
      amount?: number;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
      period?: string;
      paidAt?: string;
    },
  ) {
    const existing = await (this.prisma as any).storeExtraIncome.findFirst({
      where: { id: incomeId, storeId },
    });
    if (!existing) {
      throw new NotFoundException('Store extra income not found');
    }

    const payload = this.normalizeExtraIncomeInput({
      name: data.name ?? existing.name,
      amount: data.amount ?? existing.amount,
      bankTransferPaid: data.bankTransferPaid ?? existing.bankTransferPaid,
      cashbox1Paid: data.cashbox1Paid ?? existing.cashbox1Paid,
      cashbox2Paid: data.cashbox2Paid ?? existing.cashbox2Paid,
      period:
        data.period ??
        `${existing.period.getFullYear()}-${String(
          existing.period.getMonth() + 1,
        ).padStart(2, '0')}`,
      paidAt: data.paidAt ?? existing.paidAt.toISOString(),
    });

    return (this.prisma as any).storeExtraIncome.update({
      where: { id: incomeId },
      data: {
        name: payload.name,
        amount: payload.amount,
        bankTransferPaid: payload.bankTransferPaid,
        cashbox1Paid: payload.cashbox1Paid,
        cashbox2Paid: payload.cashbox2Paid,
        period: payload.period,
        paidAt: payload.paidAt,
      },
    });
  }

  async deleteStoreExtraIncome(storeId: number, incomeId: number) {
    const existing = await (this.prisma as any).storeExtraIncome.findFirst({
      where: { id: incomeId, storeId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Store extra income not found');
    }
    return (this.prisma as any).storeExtraIncome.delete({
      where: { id: incomeId },
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
        const actual = await this.getActualAccountingByDay(
          storeId,
          startOfDay(record.recordDate),
        );
        const actualBank = actual.bankTransferPaid;
        const actualCashbox1 = actual.cashbox1Paid;
        const actualCashbox2 = actual.cashbox2Paid;
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

  private parseAccountingDay(date?: string) {
    if (!date) return startOfDay(new Date());
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    return startOfDay(parsedDate);
  }

  private normalizeAccountingAmounts(data: {
    bankTransferPaid?: number;
    cashbox1Paid?: number;
    cashbox2Paid?: number;
  }) {
    const bankTransferPaid = Number(data.bankTransferPaid ?? 0);
    const cashbox1Paid = Number(data.cashbox1Paid ?? 0);
    const cashbox2Paid = Number(data.cashbox2Paid ?? 0);

    if (bankTransferPaid < 0 || cashbox1Paid < 0 || cashbox2Paid < 0) {
      throw new BadRequestException('Amounts must be non-negative');
    }

    return { bankTransferPaid, cashbox1Paid, cashbox2Paid };
  }

  private mapExpenseToChannels(expense: {
    amount: number;
    paymentMethod: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2' | null;
    bankTransferPaid: number;
    cashbox1Paid: number;
    cashbox2Paid: number;
  }) {
    const bankTransferPaid = Number(expense.bankTransferPaid ?? 0);
    const cashbox1Paid = Number(expense.cashbox1Paid ?? 0);
    const cashbox2Paid = Number(expense.cashbox2Paid ?? 0);
    const explicitTotal = bankTransferPaid + cashbox1Paid + cashbox2Paid;
    if (explicitTotal > 0) {
      return {
        bankTransferPaid,
        cashbox1Paid,
        cashbox2Paid,
        total: explicitTotal,
      };
    }

    const amount = Number(expense.amount ?? 0);
    if (amount <= 0) {
      return {
        bankTransferPaid: 0,
        cashbox1Paid: 0,
        cashbox2Paid: 0,
        total: 0,
      };
    }

    const method = expense.paymentMethod ?? 'BANK_TRANSFER';
    return {
      bankTransferPaid: method === 'BANK_TRANSFER' ? amount : 0,
      cashbox1Paid: method === 'CASHBOX1' ? amount : 0,
      cashbox2Paid: method === 'CASHBOX2' ? amount : 0,
      total: amount,
    };
  }

  private sumExpenseChannels(
    expenses: Array<{
      amount: number;
      paymentMethod: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2' | null;
      bankTransferPaid: number;
      cashbox1Paid: number;
      cashbox2Paid: number;
    }>,
  ) {
    return expenses.reduce(
      (acc, expense) => {
        const channels = this.mapExpenseToChannels(expense);
        acc.bankTransferPaid += channels.bankTransferPaid;
        acc.cashbox1Paid += channels.cashbox1Paid;
        acc.cashbox2Paid += channels.cashbox2Paid;
        acc.total += channels.total;
        return acc;
      },
      {
        bankTransferPaid: 0,
        cashbox1Paid: 0,
        cashbox2Paid: 0,
        total: 0,
      },
    );
  }

  private async getActualAccountingByDay(storeId: number, dayStart: Date) {
    const dayEnd = endOfDay(dayStart);
    const storeExtraIncomeRepo = (this.prisma as any).storeExtraIncome;
    const [pavilionPayments, additionalChargePayments, storeExtraIncomePayments, paidExpenses] = await Promise.all([
      this.prisma.paymentTransaction.aggregate({
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
      }),
      this.prisma.additionalChargePayment.aggregate({
        where: {
          additionalCharge: {
            pavilion: {
              storeId,
            },
          },
          paidAt: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
        _sum: {
          bankTransferPaid: true,
          cashbox1Paid: true,
          cashbox2Paid: true,
        },
      }),
      storeExtraIncomeRepo?.aggregate
        ? storeExtraIncomeRepo.aggregate({
            where: {
              storeId,
              paidAt: {
                gte: dayStart,
                lte: dayEnd,
              },
            },
            _sum: {
              bankTransferPaid: true,
              cashbox1Paid: true,
              cashbox2Paid: true,
            },
          })
        : Promise.resolve({
            _sum: {
              bankTransferPaid: 0,
              cashbox1Paid: 0,
              cashbox2Paid: 0,
            },
          }),
      this.prisma.pavilionExpense.findMany({
        where: {
          status: 'PAID' as any,
          createdAt: {
            gte: dayStart,
            lte: dayEnd,
          },
          OR: [{ storeId }, { pavilion: { storeId } }],
        },
        select: {
          amount: true,
          paymentMethod: true,
          bankTransferPaid: true,
          cashbox1Paid: true,
          cashbox2Paid: true,
        },
      }),
    ]);

    const expenseTotals = this.sumExpenseChannels(
      paidExpenses.map((expense) => ({
        amount: Number(expense.amount ?? 0),
        paymentMethod: (expense.paymentMethod as any) ?? null,
        bankTransferPaid: Number(expense.bankTransferPaid ?? 0),
        cashbox1Paid: Number(expense.cashbox1Paid ?? 0),
        cashbox2Paid: Number(expense.cashbox2Paid ?? 0),
      })),
    );

    const bankTransferPaid =
      (pavilionPayments._sum.bankTransferPaid ?? 0) +
      (additionalChargePayments._sum.bankTransferPaid ?? 0) +
      (storeExtraIncomePayments._sum.bankTransferPaid ?? 0) -
      expenseTotals.bankTransferPaid;
    const cashbox1Paid =
      (pavilionPayments._sum.cashbox1Paid ?? 0) +
      (additionalChargePayments._sum.cashbox1Paid ?? 0) +
      (storeExtraIncomePayments._sum.cashbox1Paid ?? 0) -
      expenseTotals.cashbox1Paid;
    const cashbox2Paid =
      (pavilionPayments._sum.cashbox2Paid ?? 0) +
      (additionalChargePayments._sum.cashbox2Paid ?? 0) +
      (storeExtraIncomePayments._sum.cashbox2Paid ?? 0) -
      expenseTotals.cashbox2Paid;

    return {
      bankTransferPaid,
      cashbox1Paid,
      cashbox2Paid,
      total: bankTransferPaid + cashbox1Paid + cashbox2Paid,
    };
  }

  async getAccountingDayReconciliation(storeId: number, date?: string) {
    const dayStart = this.parseAccountingDay(date);
    const dayEnd = endOfDay(dayStart);

    const records = await this.prisma.storeAccountingRecord.findMany({
      where: {
        storeId,
        recordDate: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const openRecord = records[0] ?? null;
    const closeRecord = records.length > 1 ? records[records.length - 1] : null;
    const actual = await this.getActualAccountingByDay(storeId, dayStart);

    const opening = openRecord
      ? {
          bankTransferPaid: openRecord.bankTransferPaid,
          cashbox1Paid: openRecord.cashbox1Paid,
          cashbox2Paid: openRecord.cashbox2Paid,
          total:
            openRecord.bankTransferPaid +
            openRecord.cashbox1Paid +
            openRecord.cashbox2Paid,
        }
      : null;

    const expectedClose = opening
      ? {
          bankTransferPaid: opening.bankTransferPaid + actual.bankTransferPaid,
          cashbox1Paid: opening.cashbox1Paid + actual.cashbox1Paid,
          cashbox2Paid: opening.cashbox2Paid + actual.cashbox2Paid,
          total: opening.total + actual.total,
        }
      : null;

    const closing = closeRecord
      ? {
          bankTransferPaid: closeRecord.bankTransferPaid,
          cashbox1Paid: closeRecord.cashbox1Paid,
          cashbox2Paid: closeRecord.cashbox2Paid,
          total:
            closeRecord.bankTransferPaid +
            closeRecord.cashbox1Paid +
            closeRecord.cashbox2Paid,
        }
      : null;

    const difference =
      closing && expectedClose
        ? {
            bankTransferPaid:
              closing.bankTransferPaid - expectedClose.bankTransferPaid,
            cashbox1Paid: closing.cashbox1Paid - expectedClose.cashbox1Paid,
            cashbox2Paid: closing.cashbox2Paid - expectedClose.cashbox2Paid,
            total: closing.total - expectedClose.total,
          }
        : null;

    return {
      date: dayStart,
      isOpened: Boolean(openRecord),
      isClosed: Boolean(closeRecord),
      opening,
      actual,
      expectedClose,
      closing,
      difference,
    };
  }

  async getAccountingExpectedCloseDetails(storeId: number, date?: string) {
    const dayStart = this.parseAccountingDay(date);
    const dayEnd = endOfDay(dayStart);

    const records = await this.prisma.storeAccountingRecord.findMany({
      where: {
        storeId,
        recordDate: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const openRecord = records[0] ?? null;
    const opening = openRecord
      ? {
          bankTransferPaid: openRecord.bankTransferPaid,
          cashbox1Paid: openRecord.cashbox1Paid,
          cashbox2Paid: openRecord.cashbox2Paid,
          total:
            openRecord.bankTransferPaid +
            openRecord.cashbox1Paid +
            openRecord.cashbox2Paid,
        }
      : null;

    const [pavilionPayments, additionalChargePayments, storeExtraIncomeItems, paidExpenses] =
      await Promise.all([
        this.prisma.paymentTransaction.findMany({
          where: {
            pavilion: { storeId },
            createdAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            createdAt: true,
            rentPaid: true,
            utilitiesPaid: true,
            advertisingPaid: true,
            bankTransferPaid: true,
            cashbox1Paid: true,
            cashbox2Paid: true,
            pavilion: {
              select: {
                id: true,
                number: true,
              },
            },
          },
        }),
        this.prisma.additionalChargePayment.findMany({
          where: {
            additionalCharge: {
              pavilion: { storeId },
            },
            paidAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
          orderBy: [{ paidAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            paidAt: true,
            amountPaid: true,
            bankTransferPaid: true,
            cashbox1Paid: true,
            cashbox2Paid: true,
            additionalCharge: {
              select: {
                id: true,
                name: true,
                pavilion: {
                  select: {
                    id: true,
                    number: true,
                  },
                },
              },
            },
          },
        }),
        (this.prisma as any).storeExtraIncome?.findMany
          ? (this.prisma as any).storeExtraIncome.findMany({
              where: {
                storeId,
                paidAt: {
                  gte: dayStart,
                  lte: dayEnd,
                },
              },
              orderBy: [{ paidAt: 'asc' }, { id: 'asc' }],
              select: {
                id: true,
                name: true,
                amount: true,
                bankTransferPaid: true,
                cashbox1Paid: true,
                cashbox2Paid: true,
                paidAt: true,
              },
            })
          : Promise.resolve([]),
        this.prisma.pavilionExpense.findMany({
          where: {
            status: 'PAID' as any,
            createdAt: {
              gte: dayStart,
              lte: dayEnd,
            },
            OR: [{ storeId }, { pavilion: { storeId } }],
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            createdAt: true,
            type: true,
            amount: true,
            note: true,
            paymentMethod: true,
            bankTransferPaid: true,
            cashbox1Paid: true,
            cashbox2Paid: true,
            pavilion: {
              select: {
                id: true,
                number: true,
              },
            },
          },
        }),
      ]);

    const pavilionItems = pavilionPayments.map((payment) => ({
      id: payment.id,
      paidAt: payment.createdAt,
      pavilionId: payment.pavilion.id,
      pavilionNumber: payment.pavilion.number,
      rentPaid: Number(payment.rentPaid ?? 0),
      utilitiesPaid: Number(payment.utilitiesPaid ?? 0),
      advertisingPaid: Number(payment.advertisingPaid ?? 0),
      bankTransferPaid: Number(payment.bankTransferPaid ?? 0),
      cashbox1Paid: Number(payment.cashbox1Paid ?? 0),
      cashbox2Paid: Number(payment.cashbox2Paid ?? 0),
      total:
        Number(payment.rentPaid ?? 0) +
        Number(payment.utilitiesPaid ?? 0) +
        Number(payment.advertisingPaid ?? 0),
    }));

    const additionalItems = additionalChargePayments.map((payment) => ({
      id: payment.id,
      paidAt: payment.paidAt,
      additionalChargeId: payment.additionalCharge.id,
      additionalChargeName: payment.additionalCharge.name,
      pavilionId: payment.additionalCharge.pavilion.id,
      pavilionNumber: payment.additionalCharge.pavilion.number,
      amountPaid: Number(payment.amountPaid ?? 0),
      bankTransferPaid: Number(payment.bankTransferPaid ?? 0),
      cashbox1Paid: Number(payment.cashbox1Paid ?? 0),
      cashbox2Paid: Number(payment.cashbox2Paid ?? 0),
    }));

    const extraIncomeItems = (storeExtraIncomeItems || []).map((item: any) => ({
      id: item.id,
      paidAt: item.paidAt,
      name: item.name,
      amount: Number(item.amount ?? 0),
      bankTransferPaid: Number(item.bankTransferPaid ?? 0),
      cashbox1Paid: Number(item.cashbox1Paid ?? 0),
      cashbox2Paid: Number(item.cashbox2Paid ?? 0),
    }));

    const expenseItems = paidExpenses.map((expense) => {
      const channels = this.mapExpenseToChannels({
        amount: Number(expense.amount ?? 0),
        paymentMethod: (expense.paymentMethod as any) ?? null,
        bankTransferPaid: Number(expense.bankTransferPaid ?? 0),
        cashbox1Paid: Number(expense.cashbox1Paid ?? 0),
        cashbox2Paid: Number(expense.cashbox2Paid ?? 0),
      });
      return {
        id: expense.id,
        paidAt: expense.createdAt,
        type: expense.type,
        note: expense.note,
        amount: Number(expense.amount ?? 0),
        pavilionId: expense.pavilion?.id ?? null,
        pavilionNumber: expense.pavilion?.number ?? null,
        bankTransferPaid: channels.bankTransferPaid,
        cashbox1Paid: channels.cashbox1Paid,
        cashbox2Paid: channels.cashbox2Paid,
        total: channels.total,
      };
    });

    const sumByChannels = (
      items: Array<{
        bankTransferPaid: number;
        cashbox1Paid: number;
        cashbox2Paid: number;
      }>,
    ) => {
      const bankTransferPaid = items.reduce(
        (sum, item) => sum + Number(item.bankTransferPaid ?? 0),
        0,
      );
      const cashbox1Paid = items.reduce(
        (sum, item) => sum + Number(item.cashbox1Paid ?? 0),
        0,
      );
      const cashbox2Paid = items.reduce(
        (sum, item) => sum + Number(item.cashbox2Paid ?? 0),
        0,
      );
      return {
        bankTransferPaid,
        cashbox1Paid,
        cashbox2Paid,
        total: bankTransferPaid + cashbox1Paid + cashbox2Paid,
      };
    };

    const pavilionTotals = sumByChannels(pavilionItems);
    const additionalTotals = sumByChannels(additionalItems);
    const extraIncomeTotals = sumByChannels(extraIncomeItems);
    const expenseTotals = sumByChannels(expenseItems);
    const actual = {
      bankTransferPaid:
        pavilionTotals.bankTransferPaid +
        additionalTotals.bankTransferPaid +
        extraIncomeTotals.bankTransferPaid -
        expenseTotals.bankTransferPaid,
      cashbox1Paid:
        pavilionTotals.cashbox1Paid +
        additionalTotals.cashbox1Paid +
        extraIncomeTotals.cashbox1Paid -
        expenseTotals.cashbox1Paid,
      cashbox2Paid:
        pavilionTotals.cashbox2Paid +
        additionalTotals.cashbox2Paid +
        extraIncomeTotals.cashbox2Paid -
        expenseTotals.cashbox2Paid,
    };
    const actualTotals = {
      ...actual,
      total: actual.bankTransferPaid + actual.cashbox1Paid + actual.cashbox2Paid,
    };

    const expectedClose = opening
      ? {
          bankTransferPaid: opening.bankTransferPaid + actualTotals.bankTransferPaid,
          cashbox1Paid: opening.cashbox1Paid + actualTotals.cashbox1Paid,
          cashbox2Paid: opening.cashbox2Paid + actualTotals.cashbox2Paid,
          total: opening.total + actualTotals.total,
        }
      : null;

    return {
      date: dayStart,
      opening,
      actual: {
        totals: actualTotals,
        sources: {
          pavilionPayments: pavilionTotals,
          additionalCharges: additionalTotals,
          storeExtraIncome: extraIncomeTotals,
          expenses: expenseTotals,
        },
      },
      expectedClose,
      items: {
        pavilionPayments: pavilionItems,
        additionalCharges: additionalItems,
        storeExtraIncome: extraIncomeItems,
        expenses: expenseItems,
      },
    };
  }

  async openAccountingDay(
    storeId: number,
    data: {
      date?: string;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    },
  ) {
    const dayStart = this.parseAccountingDay(data.date);
    const dayEnd = endOfDay(dayStart);
    const amounts = this.normalizeAccountingAmounts(data);

    const existing = await this.prisma.storeAccountingRecord.count({
      where: {
        storeId,
        recordDate: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    if (existing > 0) {
      throw new BadRequestException('День уже открыт');
    }

    await this.prisma.storeAccountingRecord.create({
      data: {
        storeId,
        recordDate: dayStart,
        bankTransferPaid: amounts.bankTransferPaid,
        cashbox1Paid: amounts.cashbox1Paid,
        cashbox2Paid: amounts.cashbox2Paid,
      },
    });

    return this.getAccountingDayReconciliation(storeId, dayStart.toISOString());
  }

  async closeAccountingDay(
    storeId: number,
    data: {
      date?: string;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
      forceClose?: boolean;
    },
  ) {
    const dayStart = this.parseAccountingDay(data.date);
    const dayEnd = endOfDay(dayStart);
    const amounts = this.normalizeAccountingAmounts(data);

    const records = await this.prisma.storeAccountingRecord.findMany({
      where: {
        storeId,
        recordDate: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (records.length === 0) {
      throw new BadRequestException('Сначала откройте день');
    }
    if (records.length > 1) {
      throw new BadRequestException('День уже закрыт');
    }

    const openingRecord = records[0];
    const actual = await this.getActualAccountingByDay(storeId, dayStart);
    const expectedCloseBank =
      openingRecord.bankTransferPaid + actual.bankTransferPaid;
    const expectedCloseCash1 = openingRecord.cashbox1Paid + actual.cashbox1Paid;
    const expectedCloseCash2 = openingRecord.cashbox2Paid + actual.cashbox2Paid;
    const diffBank = amounts.bankTransferPaid - expectedCloseBank;
    const diffCash1 = amounts.cashbox1Paid - expectedCloseCash1;
    const diffCash2 = amounts.cashbox2Paid - expectedCloseCash2;
    const hasMismatch =
      Math.abs(diffBank) > 0.01 ||
      Math.abs(diffCash1) > 0.01 ||
      Math.abs(diffCash2) > 0.01;

    if (hasMismatch && !data.forceClose) {
      throw new BadRequestException(
        'Вы уверены что хотите закрыть день с не схождением?',
      );
    }

    await this.prisma.storeAccountingRecord.create({
      data: {
        storeId,
        recordDate: dayStart,
        bankTransferPaid: amounts.bankTransferPaid,
        cashbox1Paid: amounts.cashbox1Paid,
        cashbox2Paid: amounts.cashbox2Paid,
      },
    });

    return this.getAccountingDayReconciliation(storeId, dayStart.toISOString());
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
        orderBy: { id: 'asc' },
      });
      const pavilionsByNumber = new Map<string, Array<{ id: number; number: string }>>();
      for (const pavilion of existingPavilions) {
        const key = pavilion.number.trim().toLowerCase();
        const bucket = pavilionsByNumber.get(key) ?? [];
        bucket.push(pavilion);
        pavilionsByNumber.set(key, bucket);
      }
      const consumedExistingByNumber = new Map<string, number>();

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

        const consumedCount = consumedExistingByNumber.get(key) ?? 0;
        const existingForKey = pavilionsByNumber.get(key) ?? [];
        const existing = existingForKey[consumedCount];
        if (existing) {
          consumedExistingByNumber.set(key, consumedCount + 1);
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

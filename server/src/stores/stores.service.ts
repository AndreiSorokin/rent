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
import { StoreActivityService } from 'src/store-activity/store-activity.service';

@Injectable()
export class StoresService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeActivity: StoreActivityService,
  ) {}
  private readonly logger = new Logger(StoresService.name);
  private monthlyRolloverTimer?: NodeJS.Timeout;
  private activityCleanupLastRunAt?: number;
  private readonly activityCleanupIntervalMs = 12 * 60 * 60 * 1000;
  private readonly activityRetentionMonths = 6;

  private comparePavilionOrder(
    a: { id: number; number: string; sortIndex?: number | null },
    b: { id: number; number: string; sortIndex?: number | null },
  ) {
    const hasCustomOrder = a.sortIndex != null || b.sortIndex != null;
    if (hasCustomOrder) {
      const aSort = a.sortIndex ?? Number.MAX_SAFE_INTEGER;
      const bSort = b.sortIndex ?? Number.MAX_SAFE_INTEGER;
      if (aSort !== bSort) return aSort - bSort;
    }

    const byNumber = String(a.number ?? '').localeCompare(String(b.number ?? ''), 'ru', {
      numeric: true,
      sensitivity: 'base',
    });
    if (byNumber !== 0) return byNumber;
    return a.id - b.id;
  }

  private compareStaffOrder(
    a: { id: number; createdAt: Date; sortIndex?: number | null },
    b: { id: number; createdAt: Date; sortIndex?: number | null },
  ) {
    const hasCustomOrder = a.sortIndex != null || b.sortIndex != null;
    if (hasCustomOrder) {
      const aSort = a.sortIndex ?? Number.MAX_SAFE_INTEGER;
      const bSort = b.sortIndex ?? Number.MAX_SAFE_INTEGER;
      if (aSort !== bSort) return aSort - bSort;
    }

    const createdDiff = b.createdAt.getTime() - a.createdAt.getTime();
    if (createdDiff !== 0) return createdDiff;
    return b.id - a.id;
  }

  onModuleInit() {
    void this.runMonthlyRolloverForAllStores();
    void this.runActivityCleanupJob();
    this.monthlyRolloverTimer = setInterval(() => {
      void this.runMonthlyRolloverForAllStores();
      void this.runActivityCleanupJob();
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
        address: true,
      },
    });
  }

  /**
   * Create store + make creator store admin (all permissions)
   */
  async create(data: Prisma.StoreCreateInput, userId: number) {
    const normalizedName = String(data.name ?? '').trim();
    const normalizedAddress =
      typeof data.address === 'string' && data.address.trim().length > 0
        ? data.address.trim()
        : null;

    if (!normalizedName) {
      throw new BadRequestException('Store name is required');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          ...data,
          name: normalizedName,
          address: normalizedAddress,
        },
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
    return result;
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

    const sortedPavilions = Array.isArray((store as any).pavilions)
      ? [...((store as any).pavilions as Array<{ id: number; number: string; sortIndex?: number | null }>)].sort(
          (a, b) => this.comparePavilionOrder(a, b),
        )
      : undefined;
    const sortedStaff = Array.isArray((store as any).staff)
      ? [
          ...((store as any).staff as Array<{
            id: number;
            createdAt: Date;
            sortIndex?: number | null;
          }>),
        ].sort((a, b) => this.compareStaffOrder(a, b))
      : undefined;

    return {
      ...store,
      ...(sortedPavilions ? { pavilions: sortedPavilions } : {}),
      ...(sortedStaff ? { staff: sortedStaff } : {}),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      permissions: store.storeUsers[0].permissions,
    };
  }

  async listActivity(
    storeId: number,
    userId: number,
    options?: {
      page?: number;
      pageSize?: number;
      date?: string;
      pavilion?: string;
      action?: string;
      entityType?: string;
    },
  ) {
    await this.assertStorePermission(storeId, userId, ['VIEW_ACTIVITY' as Permission]);
    const storeTimeZone = await this.getStoreTimeZone(storeId);
    const page = Math.max(1, Number(options?.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(options?.pageSize ?? 30)));
    const where: Prisma.StoreActivityWhereInput = { storeId };

    const action = options?.action?.trim();
    if (action) {
      where.action = action;
    }

    const entityType = options?.entityType?.trim();
    if (entityType) {
      where.entityType = entityType;
    }

    const pavilion = options?.pavilion?.trim();
    if (pavilion) {
      const variants = Array.from(
        new Set([pavilion, pavilion.toLowerCase(), pavilion.toUpperCase()]),
      );
      const matchedPavilions = await this.prisma.pavilion.findMany({
        where: {
          storeId,
          number: {
            contains: pavilion,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });
      const matchedPavilionIds = matchedPavilions.map((p) => p.id);

      where.OR = [
        ...(matchedPavilionIds.length > 0
          ? [{ pavilionId: { in: matchedPavilionIds } }]
          : []),
        ...variants.map((value) => ({
          details: {
            path: ['pavilionNumber'],
            string_contains: value,
          },
        })),
      ];
    }

    const date = options?.date?.trim();
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number);
      const from = this.zonedLocalToUtc(
        { year, month, day, hour: 0, minute: 0, second: 0, millisecond: 0 },
        storeTimeZone,
      );
      const to = this.zonedLocalToUtc(
        { year, month, day: day + 1, hour: 0, minute: 0, second: 0, millisecond: 0 },
        storeTimeZone,
      );
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
        where.createdAt = {
          gte: from,
          lt: to,
        };
      }
    }

    const [total, items] = await this.prisma.$transaction([
      (this.prisma as any).storeActivity.count({
        where,
      }),
      (this.prisma as any).storeActivity.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          pavilion: {
            select: {
              id: true,
              number: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
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

  async updateTimeZone(storeId: number, userId: number, timeZone: string) {
    await this.assertStorePermission(storeId, userId, [Permission.ASSIGN_PERMISSIONS]);
    const normalized = this.normalizeStoreTimeZone(timeZone);
    return this.prisma.store.update({
      where: { id: storeId },
      data: { timeZone: normalized },
      select: { id: true, timeZone: true },
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

  async updateAddress(
    storeId: number,
    userId: number,
    address?: string | null,
  ) {
    await this.assertStorePermission(storeId, userId, [Permission.ASSIGN_PERMISSIONS]);

    const normalizedAddress =
      typeof address === 'string' && address.trim().length > 0 ? address.trim() : null;

    return this.prisma.store.update({
      where: { id: storeId },
      data: { address: normalizedAddress },
      select: { id: true, address: true },
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

    const result = await this.prisma.$transaction(async (tx) => {
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

    const result = await this.prisma.$transaction(async (tx) => {
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
    data: {
      fullName: string;
      position: string;
      salary?: number;
      idempotencyKey?: string;
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

    const fullName = data.fullName.trim();
    const position = data.position.trim();
    const salary = Number(data.salary ?? 0);

    if (!fullName || !position) {
      throw new BadRequestException('fullName and position are required');
    }
    if (Number.isNaN(salary) || salary < 0) {
      throw new BadRequestException('salary must be non-negative');
    }

    const idempotencyKey = data.idempotencyKey?.trim();
    if (idempotencyKey) {
      const existing = await (this.prisma as any).storeStaff.findFirst({
        where: { storeId, idempotencyKey },
      });
      if (existing) {
        return existing;
      }
    }

    const lastStaffByOrder = await (this.prisma.storeStaff as any).findFirst({
      where: { storeId },
      orderBy: [{ sortIndex: 'desc' }, { id: 'desc' }],
      select: { sortIndex: true },
    });
    const nextSortIndex =
      Number(lastStaffByOrder?.sortIndex ?? 0) > 0
        ? Number(lastStaffByOrder?.sortIndex ?? 0) + 1
        : null;

    const created = await (this.prisma as any).storeStaff.create({
      data: {
        storeId,
        fullName,
        position,
        salary,
        sortIndex: nextSortIndex,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    });
    await this.logActivity({
      storeId,
      userId,
      action: 'CREATE',
      entityType: 'STAFF',
      entityId: created.id,
      details: {
        fullName: created.fullName,
        position: created.position,
        salary: Number(created.salary ?? 0),
      },
    });
    return created;
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
        fullName: true,
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
      if (!hasAnyPaidChannels && requestedStatus === 'PAID') {
        const method =
          data.salaryPaymentMethod ?? staff.salaryPaymentMethod ?? 'BANK_TRANSFER';
        nextBank = method === 'BANK_TRANSFER' ? effectiveSalaryAmount : 0;
        nextCash1 = method === 'CASHBOX1' ? effectiveSalaryAmount : 0;
        nextCash2 = method === 'CASHBOX2' ? effectiveSalaryAmount : 0;
      }

      const nextChannelsTotal = nextBank + nextCash1 + nextCash2;
      if (
        requestedStatus === 'PAID' &&
        Math.abs(nextChannelsTotal - effectiveSalaryAmount) > 0.01
      ) {
        throw new BadRequestException(
          'Salary amount must equal selected payment channels total',
        );
      }

      updateData.salaryStatus = requestedStatus;
      updateData.salaryBankTransferPaid = nextBank;
      updateData.salaryCashbox1Paid = nextCash1;
      updateData.salaryCashbox2Paid = nextCash2;
      updateData.salaryPaymentMethod = deriveSingleMethod(nextBank, nextCash1, nextCash2);
    }

    const updatedStaff = await (this.prisma.storeStaff as any).update({
      where: { id: staffId },
      data: updateData,
    });

    const previousBank =
      staff.salaryStatus === 'PAID' ? Number(staff.salaryBankTransferPaid ?? 0) : 0;
    const previousCash1 =
      staff.salaryStatus === 'PAID' ? Number(staff.salaryCashbox1Paid ?? 0) : 0;
    const previousCash2 =
      staff.salaryStatus === 'PAID' ? Number(staff.salaryCashbox2Paid ?? 0) : 0;
    const nextBank =
      updatedStaff.salaryStatus === 'PAID'
        ? Number(updatedStaff.salaryBankTransferPaid ?? 0)
        : 0;
    const nextCash1 =
      updatedStaff.salaryStatus === 'PAID'
        ? Number(updatedStaff.salaryCashbox1Paid ?? 0)
        : 0;
    const nextCash2 =
      updatedStaff.salaryStatus === 'PAID'
        ? Number(updatedStaff.salaryCashbox2Paid ?? 0)
        : 0;
    const deltaBank = nextBank - previousBank;
    const deltaCash1 = nextCash1 - previousCash1;
    const deltaCash2 = nextCash2 - previousCash2;
    if (
      Math.abs(deltaBank) > 0.009 ||
      Math.abs(deltaCash1) > 0.009 ||
      Math.abs(deltaCash2) > 0.009
    ) {
      await (this.prisma as any).storeExpenseLedger.create({
        data: {
          storeId,
          sourceType: 'STAFF',
          sourceId: updatedStaff.id,
          expenseType: PavilionExpenseType.SALARIES,
          note: `STAFF:${updatedStaff.id}:${staff.fullName ?? ''}`,
          bankTransferPaid: deltaBank,
          cashbox1Paid: deltaCash1,
          cashbox2Paid: deltaCash2,
          occurredAt: new Date(),
        },
      });
    }

    // Track salary payment as a month-bound expense entry so analytics can
    // calculate previous-month balance from historical data instead of current staff status.
    const storeTimeZone = await this.getStoreTimeZone(storeId);
    const currentMonthStart = this.getMonthPeriodInTimeZone(storeTimeZone);
    const currentMonthRange = this.getTimeZoneMonthRange(
      currentMonthStart,
      storeTimeZone,
    );
    const staffMonthExpenseNote = `STAFF:${staffId}:${currentMonthStart.toISOString()}`;

    const existingSalaryExpense = await this.prisma.pavilionExpense.findFirst({
      where: {
        storeId,
        type: PavilionExpenseType.SALARIES,
        note: staffMonthExpenseNote,
        createdAt: {
          gte: currentMonthRange.monthStart,
          lte: currentMonthRange.monthEnd,
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

    if (effectiveSalaryStatus === 'PAID' && effectiveSalaryAmountForExpense > 0.01) {
      if (existingSalaryExpense) {
        await this.prisma.pavilionExpense.update({
          where: { id: existingSalaryExpense.id },
          data: {
            amount: effectiveSalaryAmountForExpense,
            status: effectiveSalaryStatus,
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
            status: effectiveSalaryStatus,
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

    await this.logActivity({
      storeId,
      userId,
      action: 'UPDATE',
      entityType: 'STAFF',
      entityId: updatedStaff.id,
      details: {
        salary: Number(updatedStaff.salary ?? 0),
        salaryStatus: updatedStaff.salaryStatus,
        salaryBankTransferPaid: Number(updatedStaff.salaryBankTransferPaid ?? 0),
        salaryCashbox1Paid: Number(updatedStaff.salaryCashbox1Paid ?? 0),
        salaryCashbox2Paid: Number(updatedStaff.salaryCashbox2Paid ?? 0),
      },
    });
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
      select: {
        id: true,
        fullName: true,
        salaryStatus: true,
        salaryBankTransferPaid: true,
        salaryCashbox1Paid: true,
        salaryCashbox2Paid: true,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff record not found');
    }

    const deletedStaff = await this.prisma.$transaction(async (tx) => {
      if (staff.salaryStatus !== 'UNPAID') {
        const bank = Number(staff.salaryBankTransferPaid ?? 0);
        const cash1 = Number(staff.salaryCashbox1Paid ?? 0);
        const cash2 = Number(staff.salaryCashbox2Paid ?? 0);
        if (Math.abs(bank) > 0.009 || Math.abs(cash1) > 0.009 || Math.abs(cash2) > 0.009) {
          await (tx as any).storeExpenseLedger.create({
            data: {
              storeId,
              sourceType: 'STAFF',
              sourceId: staff.id,
              expenseType: PavilionExpenseType.SALARIES,
              note: `STAFF:${staff.id}:${staff.fullName ?? ''}`,
              bankTransferPaid: -bank,
              cashbox1Paid: -cash1,
              cashbox2Paid: -cash2,
              occurredAt: new Date(),
            },
          });
        }
      }

      // Remove salary expense entries generated from this staff member,
      // so summary/accounting no longer includes deleted salary.
      await tx.pavilionExpense.deleteMany({
        where: {
          storeId,
          type: PavilionExpenseType.SALARIES,
          note: {
            startsWith: `STAFF:${staffId}:`,
          },
        },
      });

      return tx.storeStaff.delete({
        where: { id: staffId },
      });
    });
    await this.logActivity({
      storeId,
      userId,
      action: 'DELETE',
      entityType: 'STAFF',
      entityId: deletedStaff.id,
      details: {
        fullName: deletedStaff.fullName,
        position: deletedStaff.position,
      },
    });
    return deletedStaff;
  }

  async reorderStaff(storeId: number, userId: number, orderedIds: number[]) {
    await this.assertStorePermission(storeId, userId, [
      Permission.MANAGE_STAFF,
      Permission.ASSIGN_PERMISSIONS,
    ]);

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new BadRequestException('orderedIds must contain at least one staff id');
    }

    const normalizedIds = Array.from(
      new Set(
        orderedIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    );

    if (normalizedIds.length !== orderedIds.length) {
      throw new BadRequestException('orderedIds must contain unique integer ids');
    }

    const existing = await (this.prisma.storeStaff as any).findMany({
      where: { storeId, id: { in: normalizedIds } },
      select: { id: true },
    });
    if (existing.length !== normalizedIds.length) {
      throw new NotFoundException('Some staff records were not found in this store');
    }

    await this.prisma.$transaction(
      normalizedIds.map((id, index) =>
        (this.prisma.storeStaff as any).update({
          where: { id },
          data: { sortIndex: index + 1 },
        }),
      ),
    );

    await this.logActivity({
      storeId,
      userId,
      action: 'UPDATE',
      entityType: 'STAFF_ORDER',
      details: {
        count: normalizedIds.length,
      },
    });

    return { success: true };
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

  private parseMonthPeriod(period?: string, timeZone = 'UTC') {
    if (!period) {
      return this.getMonthPeriodInTimeZone(timeZone);
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

  private async logActivity(args: {
    storeId: number;
    userId?: number;
    pavilionId?: number | null;
    action: string;
    entityType: string;
    entityId?: number;
    details?: Prisma.InputJsonValue;
  }) {
    await this.storeActivity.log({
      storeId: args.storeId,
      userId: args.userId,
      pavilionId: args.pavilionId ?? null,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      details: args.details,
    });
  }

  private normalizeExtraIncomeInput(
    data: {
      name?: string;
      amount?: number;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
      period?: string;
      paidAt?: string;
      idempotencyKey?: string;
    },
    timeZone: string,
  ) {
    const name = String(data.name ?? '').trim();
    const amount = Number(data.amount ?? 0);
    const bankTransferPaid = Number(data.bankTransferPaid ?? 0);
    const cashbox1Paid = Number(data.cashbox1Paid ?? 0);
    const cashbox2Paid = Number(data.cashbox2Paid ?? 0);
    const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();
    const period = this.parseMonthPeriod(data.period, timeZone);
    const idempotencyKey = String(data.idempotencyKey ?? '').trim();

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
      idempotencyKey,
    };
  }

  async listStoreExtraIncome(storeId: number, period?: string) {
    const timeZone = await this.getStoreTimeZone(storeId);
    const normalizedPeriod = this.parseMonthPeriod(period, timeZone);
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
    userId: number,
    data: {
      name: string;
      amount: number;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
      period?: string;
      paidAt?: string;
      idempotencyKey?: string;
    },
  ) {
    const timeZone = await this.getStoreTimeZone(storeId);
    const payload = this.normalizeExtraIncomeInput(data, timeZone);
    if (payload.idempotencyKey) {
      const existing = await (this.prisma as any).storeExtraIncome.findFirst({
        where: {
          storeId,
          idempotencyKey: payload.idempotencyKey,
        },
      });
      if (existing) {
        return existing;
      }
    }
    const created = await (this.prisma as any).storeExtraIncome.create({
      data: {
        storeId,
        name: payload.name,
        amount: payload.amount,
        bankTransferPaid: payload.bankTransferPaid,
        cashbox1Paid: payload.cashbox1Paid,
        cashbox2Paid: payload.cashbox2Paid,
        period: payload.period,
        paidAt: payload.paidAt,
        ...(payload.idempotencyKey
          ? { idempotencyKey: payload.idempotencyKey }
          : {}),
      },
    });
    await this.logActivity({
      storeId,
      userId,
      action: 'CREATE',
      entityType: 'STORE_EXTRA_INCOME',
      entityId: created.id,
      details: {
        name: created.name,
        amount: Number(created.amount ?? 0),
      },
    });
    return created;
  }

  async updateStoreExtraIncome(
    storeId: number,
    incomeId: number,
    userId: number,
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

    const timeZone = await this.getStoreTimeZone(storeId);
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
    }, timeZone);

    const updated = await (this.prisma as any).storeExtraIncome.update({
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
    await this.logActivity({
      storeId,
      userId,
      action: 'UPDATE',
      entityType: 'STORE_EXTRA_INCOME',
      entityId: updated.id,
      details: {
        name: updated.name,
        amount: Number(updated.amount ?? 0),
      },
    });
    return updated;
  }

  async deleteStoreExtraIncome(storeId: number, incomeId: number, userId: number) {
    const existing = await (this.prisma as any).storeExtraIncome.findFirst({
      where: { id: incomeId, storeId },
      select: { id: true, name: true, amount: true },
    });
    if (!existing) {
      throw new NotFoundException('Store extra income not found');
    }
    const deleted = await (this.prisma as any).storeExtraIncome.delete({
      where: { id: incomeId },
    });
    await this.logActivity({
      storeId,
      userId,
      action: 'DELETE',
      entityType: 'STORE_EXTRA_INCOME',
      entityId: deleted.id,
      details: {
        name: existing.name,
        amount: Number(existing.amount ?? 0),
      },
    });
    return deleted;
  }

  async listAccountingTable(storeId: number) {
    await this.cleanupOldAccountingRecords(storeId);
    const timeZone = await this.getStoreTimeZone(storeId);

    const records = await this.prisma.storeAccountingRecord.findMany({
      where: { storeId },
      orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
    });

    const recordIds = records.map((record) => record.id);
    const dayActions =
      recordIds.length > 0
        ? await (this.prisma as any).storeActivity.findMany({
            where: {
              storeId,
              entityType: 'ACCOUNTING_DAY',
              entityId: { in: recordIds },
              action: { in: ['OPEN', 'CLOSE'] },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: {
              entityId: true,
              action: true,
            },
          })
        : [];
    const recordTypeById = new Map<number, 'OPEN' | 'CLOSE'>();
    for (const activity of dayActions) {
      const id = Number(activity.entityId ?? 0);
      if (!id || recordTypeById.has(id)) continue;
      if (activity.action === 'OPEN' || activity.action === 'CLOSE') {
        recordTypeById.set(id, activity.action);
      }
    }

    return Promise.all(
      records.map(async (record) => {
        const actual = await this.getActualAccountingByDay(storeId, record.recordDate, timeZone);
        const actualBank = actual.bankTransferPaid;
        const actualCashbox1 = actual.cashbox1Paid;
        const actualCashbox2 = actual.cashbox2Paid;
        const actualTotal = actualBank + actualCashbox1 + actualCashbox2;
        const manualTotal =
          record.bankTransferPaid + record.cashbox1Paid + record.cashbox2Paid;

        return {
          ...record,
          recordType: recordTypeById.get(record.id) ?? null,
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

  private normalizeStoreTimeZone(timeZone?: string | null): string {
    const fallback = 'UTC';
    const aliases: Record<string, string> = {
      'Asia/Astana': 'Asia/Almaty',
      'Asia/Nur-Sultan': 'Asia/Almaty',
    };
    const raw = String(timeZone ?? '').trim();
    const normalizedCandidate = aliases[raw] ?? raw;
    if (!normalizedCandidate) return fallback;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: normalizedCandidate }).format(new Date());
      return normalizedCandidate;
    } catch {
      return fallback;
    }
  }

  private async getStoreTimeZone(storeId: number): Promise<string> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { timeZone: true },
    });
    return this.normalizeStoreTimeZone(store?.timeZone);
  }

  private getTimeZoneParts(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(date);
    const map = new Map(parts.map((part) => [part.type, part.value]));
    const rawHour = Number(map.get('hour'));
    return {
      year: Number(map.get('year')),
      month: Number(map.get('month')),
      day: Number(map.get('day')),
      // Some runtimes can format midnight as 24:00. For date arithmetic here
      // we need canonical 00:00 of the same local day.
      hour: rawHour === 24 ? 0 : rawHour,
      minute: Number(map.get('minute')),
      second: Number(map.get('second')),
    };
  }

  private zonedLocalToUtc(
    args: {
      year: number;
      month: number;
      day: number;
      hour?: number;
      minute?: number;
      second?: number;
      millisecond?: number;
    },
    timeZone: string,
  ) {
    const hour = args.hour ?? 0;
    const minute = args.minute ?? 0;
    const second = args.second ?? 0;
    const millisecond = args.millisecond ?? 0;
    const utcGuess = Date.UTC(
      args.year,
      args.month - 1,
      args.day,
      hour,
      minute,
      second,
      millisecond,
    );
    const guessDate = new Date(utcGuess);
    const zoned = this.getTimeZoneParts(guessDate, timeZone);
    const zonedAsUtc = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
      millisecond,
    );
    const offsetMs = zonedAsUtc - utcGuess;
    return new Date(utcGuess - offsetMs);
  }

  private getTimeZoneDayRange(date: Date, timeZone: string) {
    const local = this.getTimeZoneParts(date, timeZone);
    const dayStart = this.zonedLocalToUtc(
      {
        year: local.year,
        month: local.month,
        day: local.day,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      timeZone,
    );
    const nextDayStart = this.zonedLocalToUtc(
      {
        year: local.year,
        month: local.month,
        day: local.day + 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      timeZone,
    );
    return {
      dayStart,
      dayEnd: new Date(nextDayStart.getTime() - 1),
    };
  }

  private getMonthPeriodInTimeZone(timeZone: string, value = new Date()) {
    const local = this.getTimeZoneParts(value, timeZone);
    return startOfMonth(new Date(local.year, local.month - 1, 1));
  }

  private getTimeZoneMonthRange(period: Date, timeZone: string) {
    const year = period.getFullYear();
    const month = period.getMonth() + 1;
    const monthStart = this.zonedLocalToUtc(
      { year, month, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 },
      timeZone,
    );
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthYear = month === 12 ? year + 1 : year;
    const nextMonthStart = this.zonedLocalToUtc(
      {
        year: nextMonthYear,
        month: nextMonth,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      timeZone,
    );
    return {
      monthStart,
      monthEnd: new Date(nextMonthStart.getTime() - 1),
    };
  }

  private parseAccountingDay(date: string | undefined, timeZone: string) {
    if (!date) return this.getTimeZoneDayRange(new Date(), timeZone).dayStart;

    const normalized = String(date).trim();
    const dayOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
    if (dayOnlyMatch) {
      const year = Number(dayOnlyMatch[1]);
      const month = Number(dayOnlyMatch[2]);
      const day = Number(dayOnlyMatch[3]);
      if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(day) ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
      ) {
        throw new BadRequestException('Invalid date');
      }
      return this.zonedLocalToUtc(
        {
          year,
          month,
          day,
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0,
        },
        timeZone,
      );
    }

    const parsedDate = new Date(normalized);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    return this.getTimeZoneDayRange(parsedDate, timeZone).dayStart;
  }

  private normalizeAccountingAmounts(data: {
    bankTransferPaid?: number;
    cashbox1Paid?: number;
    cashbox2Paid?: number;
  }) {
    const bankTransferPaid = Number(data.bankTransferPaid ?? 0);
    const cashbox1Paid = Number(data.cashbox1Paid ?? 0);
    const cashbox2Paid = Number(data.cashbox2Paid ?? 0);

    if (
      Number.isNaN(bankTransferPaid) ||
      Number.isNaN(cashbox1Paid) ||
      Number.isNaN(cashbox2Paid)
    ) {
      throw new BadRequestException('Amounts must be valid numbers');
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

  private async getActualAccountingByDay(storeId: number, dayStart: Date, timeZone: string) {
    const { dayEnd } = this.getTimeZoneDayRange(dayStart, timeZone);
    const storeExtraIncomeRepo = (this.prisma as any).storeExtraIncome;
    const [pavilionPayments, additionalChargePayments, storeExtraIncomePayments, expenseSnapshot] = await Promise.all([
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
      this.getExpenseSnapshotForDay(storeId, dayStart, dayEnd),
    ]);

    const expenseTotals = expenseSnapshot.totals;

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

  private async getLedgerCutoverDayStart(storeId: number): Promise<Date | null> {
    const ledgerMin = await (this.prisma as any).storeExpenseLedger.aggregate({
      where: { storeId },
      _min: { occurredAt: true },
    });
    const minOccurredAt = ledgerMin?._min?.occurredAt
      ? new Date(ledgerMin._min.occurredAt)
      : null;
    if (!minOccurredAt) return null;
    const timeZone = await this.getStoreTimeZone(storeId);
    return this.parseAccountingDay(minOccurredAt.toISOString(), timeZone);
  }

  private async getLegacyExpenseSnapshotForDay(storeId: number, dayStart: Date, dayEnd: Date) {
    const legacyExpenses = await this.prisma.pavilionExpense.findMany({
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
    });

    const items = legacyExpenses.map((expense) => {
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

    const totals = items.reduce(
      (acc, item) => {
        acc.bankTransferPaid += Number(item.bankTransferPaid ?? 0);
        acc.cashbox1Paid += Number(item.cashbox1Paid ?? 0);
        acc.cashbox2Paid += Number(item.cashbox2Paid ?? 0);
        acc.total += Number(item.total ?? 0);
        return acc;
      },
      {
        bankTransferPaid: 0,
        cashbox1Paid: 0,
        cashbox2Paid: 0,
        total: 0,
      },
    );

    return { totals, items };
  }

  private async getExpenseSnapshotForDay(storeId: number, dayStart: Date, dayEnd: Date) {
    const cutoverDayStart = await this.getLedgerCutoverDayStart(storeId);
    const useLegacy = cutoverDayStart ? dayStart < cutoverDayStart : true;

    if (useLegacy) {
      return this.getLegacyExpenseSnapshotForDay(storeId, dayStart, dayEnd);
    }

    const ledgerItems = await (this.prisma as any).storeExpenseLedger.findMany({
      where: {
        storeId,
        occurredAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        occurredAt: true,
        expenseType: true,
        note: true,
        bankTransferPaid: true,
        cashbox1Paid: true,
        cashbox2Paid: true,
      },
    });

    const items = ledgerItems.map((expense: any) => {
      const bankTransferPaid = Number(expense.bankTransferPaid ?? 0);
      const cashbox1Paid = Number(expense.cashbox1Paid ?? 0);
      const cashbox2Paid = Number(expense.cashbox2Paid ?? 0);
      const signedTotal = bankTransferPaid + cashbox1Paid + cashbox2Paid;

      return {
        id: expense.id,
        paidAt: expense.occurredAt,
        type: expense.expenseType,
        note: expense.note,
        amount: Math.abs(signedTotal),
        pavilionId: null,
        pavilionNumber: null,
        bankTransferPaid,
        cashbox1Paid,
        cashbox2Paid,
        total: Math.abs(signedTotal),
      };
    });

    const totals = ledgerItems.reduce(
      (acc: any, item: any) => {
        acc.bankTransferPaid += Number(item.bankTransferPaid ?? 0);
        acc.cashbox1Paid += Number(item.cashbox1Paid ?? 0);
        acc.cashbox2Paid += Number(item.cashbox2Paid ?? 0);
        return acc;
      },
      {
        bankTransferPaid: 0,
        cashbox1Paid: 0,
        cashbox2Paid: 0,
      },
    );

    if (ledgerItems.length === 0) {
      return this.getLegacyExpenseSnapshotForDay(storeId, dayStart, dayEnd);
    }

    return {
      totals: {
        ...totals,
        total: totals.bankTransferPaid + totals.cashbox1Paid + totals.cashbox2Paid,
      },
      items,
    };
  }

  private async resolveAccountingDayOpenCloseRecords(
    storeId: number,
    dayStart: Date,
    dayEnd: Date,
  ) {
    const records = await this.prisma.storeAccountingRecord.findMany({
      where: {
        storeId,
        recordDate: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    if (records.length === 0) {
      return {
        records,
        openRecord: null as (typeof records)[number] | null,
        closeRecord: null as (typeof records)[number] | null,
      };
    }

    const recordIds = records.map((record) => record.id);
    const dayActions = await (this.prisma as any).storeActivity.findMany({
      where: {
        storeId,
        entityType: 'ACCOUNTING_DAY',
        entityId: { in: recordIds },
        action: { in: ['OPEN', 'CLOSE'] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        entityId: true,
        action: true,
      },
    });

    const recordTypeById = new Map<number, 'OPEN' | 'CLOSE'>();
    for (const activity of dayActions) {
      const id = Number(activity.entityId ?? 0);
      if (!id || recordTypeById.has(id)) continue;
      if (activity.action === 'OPEN' || activity.action === 'CLOSE') {
        recordTypeById.set(id, activity.action);
      }
    }

    const recordsWithType = records.map((record) => ({
      record,
      type: recordTypeById.get(record.id) ?? null,
    }));

    let openRecord: (typeof records)[number] | null =
      [...recordsWithType].reverse().find((item) => item.type === 'OPEN')?.record ??
      null;
    let closeRecord: (typeof records)[number] | null =
      [...recordsWithType].reverse().find((item) => item.type === 'CLOSE')?.record ??
      null;

    if (closeRecord) {
      // Ignore orphan or stale CLOSE records that do not have a matching OPEN
      // before them. Otherwise a deleted/missing opening blocks opening the day again.
      if (!openRecord || closeRecord.createdAt.getTime() < openRecord.createdAt.getTime()) {
        closeRecord = null;
      }
    }

    return { records, openRecord, closeRecord };
  }

  async getAccountingDayReconciliation(storeId: number, date?: string) {
    const timeZone = await this.getStoreTimeZone(storeId);
    const dayStart = this.parseAccountingDay(date, timeZone);
    const { dayEnd } = this.getTimeZoneDayRange(dayStart, timeZone);

    const { openRecord, closeRecord } = await this.resolveAccountingDayOpenCloseRecords(
      storeId,
      dayStart,
      dayEnd,
    );
    const actual = await this.getActualAccountingByDay(storeId, dayStart, timeZone);

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
    const timeZone = await this.getStoreTimeZone(storeId);
    const dayStart = this.parseAccountingDay(date, timeZone);
    const { dayEnd } = this.getTimeZoneDayRange(dayStart, timeZone);

    const { openRecord } = await this.resolveAccountingDayOpenCloseRecords(
      storeId,
      dayStart,
      dayEnd,
    );
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

    const [pavilionPayments, additionalChargePayments, storeExtraIncomeItems, expenseSnapshot] =
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
        this.getExpenseSnapshotForDay(storeId, dayStart, dayEnd),
      ]);

    const pavilionItems = pavilionPayments.map((payment) => {
      const rent = Number(payment.rentPaid ?? 0);
      const utilities = Number(payment.utilitiesPaid ?? 0);
      const advertising = Number(payment.advertisingPaid ?? 0);
      const channelsTotal =
        Number(payment.bankTransferPaid ?? 0) +
        Number(payment.cashbox1Paid ?? 0) +
        Number(payment.cashbox2Paid ?? 0);
      const rawTotal = rent + utilities + advertising;

      return {
      id: payment.id,
      paidAt: payment.createdAt,
      pavilionId: payment.pavilion.id,
      pavilionNumber: payment.pavilion.number,
      rentPaid: rent,
      utilitiesPaid: utilities,
      advertisingPaid: advertising,
      bankTransferPaid: Number(payment.bankTransferPaid ?? 0),
      cashbox1Paid: Number(payment.cashbox1Paid ?? 0),
      cashbox2Paid: Number(payment.cashbox2Paid ?? 0),
      total: rawTotal > 0 ? rawTotal : channelsTotal,
    };
    });

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

    const expenseItems = expenseSnapshot.items;

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
    const expenseTotals = expenseSnapshot.totals;
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
    userId: number,
    data: {
      date?: string;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    },
  ) {
    const timeZone = await this.getStoreTimeZone(storeId);
    const dayStart = this.parseAccountingDay(data.date, timeZone);
    const { dayEnd } = this.getTimeZoneDayRange(dayStart, timeZone);
    const amounts = this.normalizeAccountingAmounts(data);

    const { openRecord } = await this.resolveAccountingDayOpenCloseRecords(
      storeId,
      dayStart,
      dayEnd,
    );

    if (openRecord) {
      throw new BadRequestException('День уже открыт');
    }

    const openingRecord = await this.prisma.storeAccountingRecord.create({
      data: {
        storeId,
        recordDate: dayStart,
        bankTransferPaid: amounts.bankTransferPaid,
        cashbox1Paid: amounts.cashbox1Paid,
        cashbox2Paid: amounts.cashbox2Paid,
      },
    });
    await this.logActivity({
      storeId,
      userId,
      action: 'OPEN',
      entityType: 'ACCOUNTING_DAY',
      entityId: openingRecord.id,
      details: {
        date: dayStart.toISOString(),
        bankTransferPaid: amounts.bankTransferPaid,
        cashbox1Paid: amounts.cashbox1Paid,
        cashbox2Paid: amounts.cashbox2Paid,
      },
    });

    return this.getAccountingDayReconciliation(storeId, dayStart.toISOString());
  }

  async closeAccountingDay(
    storeId: number,
    userId: number,
    data: {
      date?: string;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
      forceClose?: boolean;
    },
  ) {
    const timeZone = await this.getStoreTimeZone(storeId);
    const dayStart = this.parseAccountingDay(data.date, timeZone);
    const { dayEnd } = this.getTimeZoneDayRange(dayStart, timeZone);
    const amounts = this.normalizeAccountingAmounts(data);

    const { openRecord, closeRecord } = await this.resolveAccountingDayOpenCloseRecords(
      storeId,
      dayStart,
      dayEnd,
    );

    if (!openRecord) {
      throw new BadRequestException('Сначала откройте день');
    }
    if (closeRecord) {
      throw new BadRequestException('День уже закрыт');
    }

    const actual = await this.getActualAccountingByDay(storeId, dayStart, timeZone);
    const expectedCloseBank =
      openRecord.bankTransferPaid + actual.bankTransferPaid;
    const expectedCloseCash1 = openRecord.cashbox1Paid + actual.cashbox1Paid;
    const expectedCloseCash2 = openRecord.cashbox2Paid + actual.cashbox2Paid;
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

    const closingRecord = await this.prisma.storeAccountingRecord.create({
      data: {
        storeId,
        recordDate: dayStart,
        bankTransferPaid: amounts.bankTransferPaid,
        cashbox1Paid: amounts.cashbox1Paid,
        cashbox2Paid: amounts.cashbox2Paid,
      },
    });
    await this.logActivity({
      storeId,
      userId,
      action: 'CLOSE',
      entityType: 'ACCOUNTING_DAY',
      entityId: closingRecord.id,
      details: {
        date: dayStart.toISOString(),
        bankTransferPaid: amounts.bankTransferPaid,
        cashbox1Paid: amounts.cashbox1Paid,
        cashbox2Paid: amounts.cashbox2Paid,
        diffBank,
        diffCash1,
        diffCash2,
      },
    });

    return this.getAccountingDayReconciliation(storeId, dayStart.toISOString());
  }

  async createAccountingRecord(
    storeId: number,
    userId: number,
    data: {
      recordDate: string;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    },
  ) {
    const timeZone = await this.getStoreTimeZone(storeId);
    const parsedDate = this.parseAccountingDay(data.recordDate, timeZone);

    const bankTransferPaid = Number(data.bankTransferPaid ?? 0);
    const cashbox1Paid = Number(data.cashbox1Paid ?? 0);
    const cashbox2Paid = Number(data.cashbox2Paid ?? 0);

    if (bankTransferPaid < 0 || cashbox1Paid < 0 || cashbox2Paid < 0) {
      throw new BadRequestException('Amounts must be non-negative');
    }

    await this.cleanupOldAccountingRecords(storeId);

    const created = await this.prisma.storeAccountingRecord.create({
      data: {
        storeId,
        recordDate: parsedDate,
        bankTransferPaid,
        cashbox1Paid,
        cashbox2Paid,
      },
    });
    await this.logActivity({
      storeId,
      userId,
      action: 'CREATE',
      entityType: 'ACCOUNTING_RECORD',
      entityId: created.id,
      details: {
        recordDate: created.recordDate.toISOString(),
        bankTransferPaid: created.bankTransferPaid,
        cashbox1Paid: created.cashbox1Paid,
        cashbox2Paid: created.cashbox2Paid,
      },
    });
    return created;
  }

  async deleteAccountingRecord(storeId: number, recordId: number, userId: number) {
    const record = await this.prisma.storeAccountingRecord.findFirst({
      where: { id: recordId, storeId },
      select: {
        id: true,
        recordDate: true,
        bankTransferPaid: true,
        cashbox1Paid: true,
        cashbox2Paid: true,
      },
    });

    if (!record) {
      throw new NotFoundException('Accounting record not found');
    }

    const deleted = await this.prisma.storeAccountingRecord.delete({
      where: { id: recordId },
    });
    await this.logActivity({
      storeId,
      userId,
      action: 'DELETE',
      entityType: 'ACCOUNTING_RECORD',
      entityId: deleted.id,
      details: {
        recordDate: record.recordDate.toISOString(),
        bankTransferPaid: record.bankTransferPaid,
        cashbox1Paid: record.cashbox1Paid,
        cashbox2Paid: record.cashbox2Paid,
      },
    });
    return deleted;
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
    if (!storeUser.permissions.includes(Permission.CREATE_PAVILIONS)) {
      throw new ForbiddenException(
        'Insufficient permissions to import pavilion data',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const timeZone = await this.getStoreTimeZone(storeId);
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
      const importedPavilionList: string[] = [];
      const currentPeriod = this.getMonthPeriodInTimeZone(timeZone);

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
              ? endOfMonth(currentPeriod)
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
        const statusLabel =
          normalizedStatus === PavilionStatus.AVAILABLE
            ? 'Свободен'
            : normalizedStatus === PavilionStatus.RENTED
              ? 'Занят'
              : 'Предоплата';
        importedPavilionList.push(`${number} (${statusLabel})`);
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
        let parsedDate: Date;
        try {
          parsedDate = this.parseAccountingDay(item.recordDate, timeZone);
        } catch {
          continue;
        }
        await tx.storeAccountingRecord.create({
          data: {
            storeId,
            recordDate: parsedDate,
            bankTransferPaid: Number(item.bankTransferPaid ?? 0),
            cashbox1Paid: Number(item.cashbox1Paid ?? 0),
            cashbox2Paid: Number(item.cashbox2Paid ?? 0),
          },
        });
        importedAccounting += 1;
      }

      let importedStaffSortIndex = 0;
      for (const item of data.staff ?? []) {
        const fullName = item.fullName?.trim();
        const position = item.position?.trim();
        const salary = Number(item.salary ?? 0);
        if (!fullName || !position || Number.isNaN(salary)) continue;
        importedStaffSortIndex += 1;

        await (tx.storeStaff as any).create({
          data: {
            storeId,
            fullName,
            position,
            salary,
            salaryStatus: item.salaryStatus ?? 'UNPAID',
            sortIndex: importedStaffSortIndex,
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
        importedPavilionList,
      };
    });
    await this.storeActivity.log({
      storeId,
      userId,
      action: 'IMPORT',
      entityType: 'PAVILION_IMPORT',
      entityId: null,
      details: {
        pavilions: result.importedPavilionList,
      },
    });
    return result;
  }

  async exportData(storeId: number, userId: number) {
    const storeUser = await this.prisma.storeUser.findUnique({
      where: { userId_storeId: { userId, storeId } },
      select: { permissions: true },
    });

    if (!storeUser) {
      throw new NotFoundException('Store not found or access denied');
    }
    if (!storeUser.permissions.includes(Permission.EXPORT_STORE_DATA)) {
      throw new ForbiddenException(
        'Insufficient permissions to export pavilion data',
      );
    }

    const storeTimeZone = await this.getStoreTimeZone(storeId);
    const toIsoDate = (value: Date) => {
      const parts = this.getTimeZoneParts(value, storeTimeZone);
      const year = parts.year;
      const month = String(parts.month).padStart(2, '0');
      const day = String(parts.day).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const [pavilions, householdExpensesRaw, expensesRaw, accountingRaw, staffRaw] =
      await Promise.all([
        this.prisma.pavilion.findMany({
          where: { storeId },
          orderBy: [{ number: 'asc' }, { id: 'asc' }],
          select: {
            number: true,
            category: true,
            squareMeters: true,
            pricePerSqM: true,
            utilitiesAmount: true,
            status: true,
            tenantName: true,
            advertisingAmount: true,
          },
        }),
        this.prisma.pavilionExpense.findMany({
          where: {
            storeId,
            type: 'HOUSEHOLD' as any,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            note: true,
            amount: true,
            status: true,
          },
        }),
        this.prisma.pavilionExpense.findMany({
          where: {
            storeId,
            type: {
              in: [
                'PAYROLL_TAX',
                'PROFIT_TAX',
                'DIVIDENDS',
                'BANK_SERVICES',
                'VAT',
                'LAND_RENT',
                'OTHER',
              ] as any,
            },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            type: true,
            amount: true,
            status: true,
            note: true,
          },
        }),
        this.prisma.storeAccountingRecord.findMany({
          where: { storeId },
          orderBy: [{ recordDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          select: {
            recordDate: true,
            bankTransferPaid: true,
            cashbox1Paid: true,
            cashbox2Paid: true,
          },
        }),
        (this.prisma.storeStaff as any).findMany({
          where: { storeId },
          orderBy: [{ sortIndex: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          select: {
            fullName: true,
            position: true,
            salary: true,
            salaryStatus: true,
          },
        }),
      ]);

    return {
      pavilions: pavilions.map((item) => ({
        number: item.number,
        category: item.category,
        squareMeters: Number(item.squareMeters ?? 0),
        pricePerSqM: Number(item.pricePerSqM ?? 0),
        utilitiesAmount:
          item.utilitiesAmount === null ? null : Number(item.utilitiesAmount),
        status: item.status,
        tenantName: item.tenantName,
        advertisingAmount:
          item.advertisingAmount === null ? null : Number(item.advertisingAmount),
      })),
      householdExpenses: householdExpensesRaw.map((item) => ({
        name: item.note ?? '',
        amount: Number(item.amount ?? 0),
        status: item.status,
      })),
      expenses: expensesRaw.map((item) => ({
        type: item.type,
        amount: Number(item.amount ?? 0),
        status: item.status,
        note: item.note ?? null,
      })),
      accounting: accountingRaw.map((item) => ({
        recordDate: toIsoDate(item.recordDate),
        bankTransferPaid: Number(item.bankTransferPaid ?? 0),
        cashbox1Paid: Number(item.cashbox1Paid ?? 0),
        cashbox2Paid: Number(item.cashbox2Paid ?? 0),
      })),
      staff: staffRaw.map((item) => ({
        fullName: item.fullName,
        position: item.position,
        salary: Number(item.salary ?? 0),
        salaryStatus: item.salaryStatus,
      })),
    };
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
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        timeZone: true,
        lastMonthlyResetPeriod: true,
      },
    });
    if (!store) return;

    const timeZone = this.normalizeStoreTimeZone(store.timeZone);
    const currentPeriod = this.getMonthPeriodInTimeZone(timeZone);
    const previousPeriod = startOfMonth(subMonths(currentPeriod, 1));
    const previousPeriodRange = this.getTimeZoneMonthRange(previousPeriod, timeZone);

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
              gte: previousPeriodRange.monthStart,
              lte: previousPeriodRange.monthEnd,
            },
          },
          include: {
            payments: {
              where: {
                paidAt: {
                  gte: previousPeriodRange.monthStart,
                  lte: previousPeriodRange.monthEnd,
                },
              },
            },
          },
        },
        monthlyLedgers: {
          where: {
            period: startOfMonth(subMonths(previousPeriod, 1)),
          },
          orderBy: { period: 'desc' },
          take: 1,
        },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const pavilion of pavilions) {
        const openingDebt = pavilion.monthlyLedgers[0]?.closingDebt ?? 0;
        const baseRent = Number(
          pavilion.rentAmount ?? pavilion.squareMeters * pavilion.pricePerSqM,
        );
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

        const actualRentAndUtilities = pavilion.payments.reduce((sum, payment) => {
          const rentRaw = Number(payment.rentPaid ?? 0);
          const rentChannels =
            Number(payment.rentBankTransferPaid ?? 0) +
            Number(payment.rentCashbox1Paid ?? 0) +
            Number(payment.rentCashbox2Paid ?? 0);
          const utilitiesRaw = Number(payment.utilitiesPaid ?? 0);
          const utilitiesChannels =
            Number(payment.utilitiesBankTransferPaid ?? 0) +
            Number(payment.utilitiesCashbox1Paid ?? 0) +
            Number(payment.utilitiesCashbox2Paid ?? 0);
          const advertisingRaw = Number(payment.advertisingPaid ?? 0);
          const advertisingChannels =
            Number(payment.advertisingBankTransferPaid ?? 0) +
            Number(payment.advertisingCashbox1Paid ?? 0) +
            Number(payment.advertisingCashbox2Paid ?? 0);

          const rent = rentRaw > 0 ? rentRaw : rentChannels;
          const utilities = utilitiesRaw > 0 ? utilitiesRaw : utilitiesChannels;
          const advertising =
            advertisingRaw > 0 ? advertisingRaw : advertisingChannels;
          return sum + rent + utilities + advertising;
        }, 0);
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
        },
      });

      await tx.pavilion.updateMany({
        where: {
          storeId,
          status: PavilionStatus.PREPAID,
        },
        data: {
          utilitiesAmount: 0,
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

  private async runActivityCleanupJob() {
    const nowMs = Date.now();
    if (
      this.activityCleanupLastRunAt &&
      nowMs - this.activityCleanupLastRunAt < this.activityCleanupIntervalMs
    ) {
      return;
    }

    this.activityCleanupLastRunAt = nowMs;

    try {
      const cutoff = subMonths(new Date(), this.activityRetentionMonths);
      const removed = await this.storeActivity.deleteOlderThan(cutoff);
      if (removed > 0) {
        this.logger.log(
          `Removed ${removed} store activity records older than ${this.activityRetentionMonths} months`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to execute store activity cleanup job', error as Error);
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

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PavilionStatus, Prisma } from '@prisma/client';
import { CreatePavilionDto } from './dto/create-pavilion.dto';
import { endOfMonth, startOfMonth } from 'date-fns';
import * as fs from 'fs';
import { join } from 'path';
import { StoreActivityService } from 'src/store-activity/store-activity.service';

@Injectable()
export class PavilionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeActivity: StoreActivityService,
  ) {}

  private enrichPavilionPaymentStatus<T extends {
    status: PavilionStatus;
    squareMeters: number;
    pricePerSqM: number;
    rentAmount: number | null;
    utilitiesAmount: number | null;
    advertisingAmount: number | null;
    payments: Array<{
      period: Date;
      rentPaid: number | null;
      utilitiesPaid: number | null;
      advertisingPaid: number | null;
      rentBankTransferPaid?: number | null;
      rentCashbox1Paid?: number | null;
      rentCashbox2Paid?: number | null;
      utilitiesBankTransferPaid?: number | null;
      utilitiesCashbox1Paid?: number | null;
      utilitiesCashbox2Paid?: number | null;
      advertisingBankTransferPaid?: number | null;
      advertisingCashbox1Paid?: number | null;
      advertisingCashbox2Paid?: number | null;
    }>;
    discounts: Array<{ amount: number; startsAt: Date; endsAt: Date | null }>;
    additionalCharges: Array<{
      amount: number;
      createdAt: Date;
      payments: Array<{ amountPaid: number; paidAt: Date }>;
    }>;
    monthlyLedgers?: Array<{
      period: Date;
      openingDebt: number;
      closingDebt: number;
    }>;
  }>(pavilion: T) {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const monthStartTime = monthStart.getTime();
    const previousMonthStartTime = startOfMonth(
      new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1),
    ).getTime();

    const currentPayment = pavilion.payments.find(
      (payment) => startOfMonth(payment.period).getTime() === monthStartTime,
    );

    const baseRent =
      pavilion.rentAmount ?? pavilion.squareMeters * pavilion.pricePerSqM;
    const discount = this.getMonthlyDiscountTotal(
      pavilion.discounts,
      pavilion.squareMeters,
      now,
    );

    const expectedRent =
      pavilion.status === PavilionStatus.AVAILABLE
        ? 0
        : pavilion.status === PavilionStatus.PREPAID
          ? baseRent
          : Math.max(baseRent - discount, 0);
    const expectedUtilities =
      pavilion.status === PavilionStatus.RENTED
        ? Number(pavilion.utilitiesAmount ?? 0)
        : 0;
    const expectedAdvertising =
      pavilion.status === PavilionStatus.RENTED
        ? Number(pavilion.advertisingAmount ?? 0)
        : 0;

    const currentMonthCharges = pavilion.additionalCharges.filter(
      (charge) => charge.createdAt >= monthStart && charge.createdAt <= monthEnd,
    );
    const expectedAdditional = currentMonthCharges.reduce(
      (sum, charge) => sum + Number(charge.amount ?? 0),
      0,
    );

    const paidRentRaw = Number(currentPayment?.rentPaid ?? 0);
    const paidRentChannels =
      Number(currentPayment?.rentBankTransferPaid ?? 0) +
      Number(currentPayment?.rentCashbox1Paid ?? 0) +
      Number(currentPayment?.rentCashbox2Paid ?? 0);
    const paidUtilitiesRaw = Number(currentPayment?.utilitiesPaid ?? 0);
    const paidUtilitiesChannels =
      Number(currentPayment?.utilitiesBankTransferPaid ?? 0) +
      Number(currentPayment?.utilitiesCashbox1Paid ?? 0) +
      Number(currentPayment?.utilitiesCashbox2Paid ?? 0);
    const paidAdvertisingRaw = Number(currentPayment?.advertisingPaid ?? 0);
    const paidAdvertisingChannels =
      Number(currentPayment?.advertisingBankTransferPaid ?? 0) +
      Number(currentPayment?.advertisingCashbox1Paid ?? 0) +
      Number(currentPayment?.advertisingCashbox2Paid ?? 0);

    const paidBase =
      (paidRentRaw > 0 ? paidRentRaw : paidRentChannels) +
      (paidUtilitiesRaw > 0 ? paidUtilitiesRaw : paidUtilitiesChannels) +
      (paidAdvertisingRaw > 0 ? paidAdvertisingRaw : paidAdvertisingChannels);
    const paidAdditional = currentMonthCharges.reduce(
      (sum, charge) =>
        sum +
        charge.payments.reduce((inner, payment) => {
          if (payment.paidAt < monthStart || payment.paidAt > monthEnd) return inner;
          return inner + Number(payment.amountPaid ?? 0);
        }, 0),
      0,
    );

    const expectedTotal =
      expectedRent + expectedUtilities + expectedAdvertising + expectedAdditional;
    const paidTotal = paidBase + paidAdditional;

    const currentMonthLedger = (pavilion.monthlyLedgers ?? []).find(
      (ledger) => startOfMonth(ledger.period).getTime() === monthStartTime,
    );
    const previousMonthLedger = (pavilion.monthlyLedgers ?? []).find(
      (ledger) => startOfMonth(ledger.period).getTime() === previousMonthStartTime,
    );
    const carryAdjustment = Number(
      previousMonthLedger?.closingDebt ?? currentMonthLedger?.openingDebt ?? 0,
    );
    const expectedWithCarry = expectedTotal + carryAdjustment;

    let paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' = 'PAID';
    if (expectedWithCarry > 0.01) {
      if (paidTotal <= 0.01) paymentStatus = 'UNPAID';
      else if (paidTotal + 0.01 >= expectedWithCarry) paymentStatus = 'PAID';
      else paymentStatus = 'PARTIAL';
    }

    return {
      ...pavilion,
      paymentStatus,
      paymentExpectedTotal: expectedTotal,
      paymentExpectedTotalWithCarry: expectedWithCarry,
      paymentCarryAdjustment: carryAdjustment,
      paymentPaidTotal: paidTotal,
      paymentBalance: paidTotal - expectedWithCarry,
    };
  }

  private calculatePrepaymentAmount(
    prepaidUntil: Date | null,
    payments: Array<{
      period: Date;
      rentPaid: number | null;
      rentBankTransferPaid: number | null;
      rentCashbox1Paid: number | null;
      rentCashbox2Paid: number | null;
    }>,
  ): number | null {
    if (!prepaidUntil) return null;
    const targetPeriodTime = startOfMonth(prepaidUntil).getTime();

    return payments
      .filter((payment) => {
        return startOfMonth(payment.period).getTime() === targetPeriodTime;
      })
      .reduce((sum, payment) => {
        const rentPaid = Number(payment.rentPaid ?? 0);
        const rentByChannels =
          Number(payment.rentBankTransferPaid ?? 0) +
          Number(payment.rentCashbox1Paid ?? 0) +
          Number(payment.rentCashbox2Paid ?? 0);
        return sum + (rentPaid > 0 ? rentPaid : rentByChannels);
      }, 0);
  }

  private toPavilionStatus(status?: string): PavilionStatus | undefined {
    if (status === PavilionStatus.AVAILABLE) return PavilionStatus.AVAILABLE;
    if (status === PavilionStatus.RENTED) return PavilionStatus.RENTED;
    if (status === PavilionStatus.PREPAID) return PavilionStatus.PREPAID;
    return undefined;
  }

  private comparePavilionNaturalOrder(
    a: { id: number; number: string; sortIndex?: number | null },
    b: { id: number; number: string; sortIndex?: number | null },
  ) {
    const hasCustomOrder =
      a.sortIndex != null || b.sortIndex != null;

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

  private sortPavilionsByStoredOrNaturalOrder<
    T extends { id: number; number: string; sortIndex?: number | null },
  >(items: T[]) {
    return [...items].sort((a, b) => this.comparePavilionNaturalOrder(a, b));
  }

  async create(storeId: number, dto: CreatePavilionDto, userId?: number) {
    const calculatedRent = dto.squareMeters * dto.pricePerSqM;
    const isPrepaid = dto.status === PavilionStatus.PREPAID;
    const parsedPrepaidUntil = dto.prepaidUntil
      ? endOfMonth(new Date(dto.prepaidUntil))
      : endOfMonth(new Date());

    const lastPavilionByOrder = await this.prisma.pavilion.findFirst({
      where: { storeId },
      orderBy: [{ sortIndex: 'desc' }, { id: 'desc' }],
      select: { sortIndex: true },
    });
    const nextSortIndex =
      Number(lastPavilionByOrder?.sortIndex ?? 0) > 0
        ? Number(lastPavilionByOrder?.sortIndex ?? 0) + 1
        : null;

    const created = await this.prisma.pavilion.create({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: {
        ...dto,
        rentAmount: dto.rentAmount ?? calculatedRent,
        sortIndex: nextSortIndex,
        status: dto.status ?? PavilionStatus.AVAILABLE,
        prepaidUntil: isPrepaid ? parsedPrepaidUntil : null,
        store: { connect: { id: storeId } },
      },
    });
    await this.refreshMonthlyLedger(created.id, startOfMonth(new Date()));
    await this.storeActivity.log({
      storeId,
      userId,
      pavilionId: created.id,
      action: 'CREATE',
      entityType: 'PAVILION',
      entityId: created.id,
      details: {
        number: created.number,
        status: created.status,
      },
    });
    return created;
  }

  async findAll(
    storeId: number,
    options?: {
      search?: string;
      status?: string;
      category?: string;
      groupId?: number;
      page?: number;
      pageSize?: number;
      paginated?: boolean;
      sortBy?: 'paymentStatus';
      sortDir?: 'asc' | 'desc';
      paymentStatusFirst?: 'PAID' | 'PARTIAL' | 'UNPAID';
      paymentStatus?: 'PAID' | 'PARTIAL' | 'UNPAID';
    },
  ) {
    await this.syncExpiredPrepayments(storeId);

    const normalizedStatus = this.toPavilionStatus(options?.status);
    const normalizedSearch = options?.search?.trim();
    const normalizedCategory = options?.category?.trim();
    const normalizedGroupId =
      options?.groupId && Number.isFinite(options.groupId) ? options.groupId : undefined;
    const page = Math.max(1, Number(options?.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(options?.pageSize ?? 20)));
    const sortBy = options?.sortBy;
    const sortDir = options?.sortDir === 'desc' ? 'desc' : 'asc';
    const paymentStatusFirst = options?.paymentStatusFirst;
    const paymentStatus = options?.paymentStatus;

    const where: Prisma.PavilionWhereInput = {
      storeId,
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
      ...(normalizedCategory
        ? { category: { equals: normalizedCategory, mode: 'insensitive' } }
        : {}),
      ...(normalizedGroupId
        ? {
            groupMemberships: {
              some: {
                groupId: normalizedGroupId,
              },
            },
          }
        : {}),
      ...(normalizedSearch
        ? {
            OR: [
              { number: { contains: normalizedSearch, mode: 'insensitive' } },
              { tenantName: { contains: normalizedSearch, mode: 'insensitive' } },
              { category: { contains: normalizedSearch, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const include = {
      additionalCharges: {
        include: {
          payments: true,
        },
      },
      discounts: true,
      payments: true,
      contracts: true,
      monthlyLedgers: {
        where: {
          period: {
            lte: startOfMonth(new Date()),
          },
        },
        orderBy: { period: 'desc' },
        take: 2,
        select: {
          period: true,
          openingDebt: true,
          closingDebt: true,
        },
      },
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
    } satisfies Prisma.PavilionInclude;

    const items = await this.prisma.pavilion.findMany({
      where,
      include,
      orderBy: [{ id: 'asc' }],
    });
    let enriched = this.sortPavilionsByStoredOrNaturalOrder(
      items.map((item) => this.enrichPavilionPaymentStatus(item)),
    );
    if (paymentStatus) {
      enriched = enriched.filter((item) => item.paymentStatus === paymentStatus);
    }
    if (sortBy === 'paymentStatus') {
      const getRank = (status: 'PAID' | 'PARTIAL' | 'UNPAID'): number => {
        if (paymentStatusFirst) {
          if (status === paymentStatusFirst) return 0;
          if (status === 'PARTIAL') return 1;
          if (status === 'UNPAID') return 2;
          return 3;
        }
        if (status === 'UNPAID') return 0;
        if (status === 'PARTIAL') return 1;
        return 2;
      };
      enriched.sort((a, b) => {
        const diff = getRank(a.paymentStatus) - getRank(b.paymentStatus);
        if (diff !== 0) return sortDir === 'asc' ? diff : -diff;
        return this.comparePavilionNaturalOrder(a, b);
      });
    }
    if (!options?.paginated) {
      return enriched;
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const total = enriched.length;
    return {
      items: enriched.slice(start, end),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  async reorder(storeId: number, orderedIds: number[], userId?: number) {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new BadRequestException('orderedIds must contain at least one pavilion id');
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

    const existing = await this.prisma.pavilion.findMany({
      where: { storeId, id: { in: normalizedIds } },
      select: { id: true },
    });
    if (existing.length !== normalizedIds.length) {
      throw new NotFoundException('Some pavilions were not found in this store');
    }

    await this.prisma.$transaction(
      normalizedIds.map((id, index) =>
        this.prisma.pavilion.update({
          where: { id },
          data: { sortIndex: index + 1 },
        }),
      ),
    );

    await this.storeActivity.log({
      storeId,
      userId,
      action: 'UPDATE',
      entityType: 'PAVILION_ORDER',
      details: {
        count: normalizedIds.length,
      },
    });

    return { success: true };
  }

  async findOne(storeId: number, id: number) {
    await this.syncExpiredPrepayments(storeId);

    const pavilion = await this.prisma.pavilion.findFirst({
      where: { id, storeId },
      include: {
        store: {
          select: {
            currency: true,
          },
        },
        contracts: { orderBy: { uploadedAt: 'desc' } },
        additionalCharges: {
          orderBy: { createdAt: 'asc' },
          include: {
            payments: { orderBy: { paidAt: 'asc' } },
          },
        },
        discounts: { orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { period: 'asc' } },
        paymentTransactions: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!pavilion) return null;

    return {
      ...pavilion,
      prepaymentAmount: this.calculatePrepaymentAmount(
        pavilion.prepaidUntil,
        pavilion.payments.map((payment) => ({
          period: payment.period,
          rentPaid: payment.rentPaid,
          rentBankTransferPaid: payment.rentBankTransferPaid,
          rentCashbox1Paid: payment.rentCashbox1Paid,
          rentCashbox2Paid: payment.rentCashbox2Paid,
        })),
      ),
    };
  }

  async update(
    storeId: number,
    pavilionId: number,
    data: Prisma.PavilionUpdateInput,
    userId?: number,
  ) {
    const pavilion = await this.prisma.pavilion.findFirst({
      where: { id: pavilionId, storeId },
    });

    if (!pavilion) {
      throw new NotFoundException('Pavilion not found in this store');
    }

    const extractNumber = (value: unknown): number | undefined => {
      if (typeof value === 'number') return value;
      if (
        typeof value === 'object' &&
        value !== null &&
        'set' in (value as Record<string, unknown>) &&
        typeof (value as { set?: unknown }).set === 'number'
      ) {
        return (value as { set: number }).set;
      }
      return undefined;
    };

    const nextSquareMeters = extractNumber(data.squareMeters);
    const nextPricePerSqM = extractNumber(data.pricePerSqM);
    const nextStatus =
      typeof data.status === 'string'
        ? data.status
        : data.status && typeof data.status === 'object' && 'set' in data.status
          ? (data.status.set as PavilionStatus)
          : undefined;
    const nextPrepaidUntil =
      typeof data.prepaidUntil === 'string'
        ? new Date(data.prepaidUntil)
        : data.prepaidUntil instanceof Date
        ? data.prepaidUntil
        : data.prepaidUntil &&
            typeof data.prepaidUntil === 'object' &&
            'set' in data.prepaidUntil &&
            (data.prepaidUntil.set instanceof Date ||
              data.prepaidUntil.set === null)
          ? data.prepaidUntil.set
          : undefined;
    const normalizedPrepaidUntil =
      nextPrepaidUntil instanceof Date && !Number.isNaN(nextPrepaidUntil.getTime())
        ? nextPrepaidUntil
        : undefined;

    if (nextSquareMeters !== undefined || nextPricePerSqM !== undefined) {
      const effectiveSquareMeters = nextSquareMeters ?? pavilion.squareMeters;
      const effectivePricePerSqM = nextPricePerSqM ?? pavilion.pricePerSqM;

      data.rentAmount = effectiveSquareMeters * effectivePricePerSqM;
    }

    if (nextStatus === PavilionStatus.PREPAID) {
      data.prepaidUntil = normalizedPrepaidUntil
        ? endOfMonth(normalizedPrepaidUntil)
        : endOfMonth(new Date());
    } else if (
      nextStatus === PavilionStatus.AVAILABLE ||
      nextStatus === PavilionStatus.RENTED
    ) {
      data.prepaidUntil = null;
    }

    const updated = await this.prisma.pavilion.update({
      where: { id: pavilionId },
      data,
    });
    await this.refreshMonthlyLedger(updated.id, startOfMonth(new Date()));

    const snapshot = (item: {
      number: string;
      category: string | null;
      status: PavilionStatus;
      tenantName: string | null;
      squareMeters: number;
      pricePerSqM: number;
      rentAmount: number | null;
      utilitiesAmount: number | null;
      advertisingAmount: number | null;
      prepaidUntil: Date | null;
    }) => ({
      number: item.number,
      category: item.category,
      status: item.status,
      tenantName: item.tenantName,
      squareMeters: Number(item.squareMeters ?? 0),
      pricePerSqM: Number(item.pricePerSqM ?? 0),
      rentAmount: Number(item.rentAmount ?? 0),
      utilitiesAmount: Number(item.utilitiesAmount ?? 0),
      advertisingAmount: Number(item.advertisingAmount ?? 0),
      prepaidUntil: item.prepaidUntil ? item.prepaidUntil.toISOString() : null,
    });

    const beforeSnapshot = snapshot(pavilion);
    const afterSnapshot = snapshot(updated);
    const changedFields = Object.keys(beforeSnapshot).filter((key) => {
      const beforeValue = beforeSnapshot[key as keyof typeof beforeSnapshot];
      const afterValue = afterSnapshot[key as keyof typeof afterSnapshot];
      return beforeValue !== afterValue;
    });

    const beforeDiff = changedFields.reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = beforeSnapshot[key as keyof typeof beforeSnapshot];
      return acc;
    }, {});
    const afterDiff = changedFields.reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = afterSnapshot[key as keyof typeof afterSnapshot];
      return acc;
    }, {});

    const detailsPayload = {
      changedFields,
      before: beforeDiff,
      after: afterDiff,
    } as unknown as Prisma.InputJsonValue;

    await this.storeActivity.log({
      storeId,
      userId,
      pavilionId: updated.id,
      action: 'UPDATE',
      entityType: 'PAVILION',
      entityId: updated.id,
      details: detailsPayload,
    });
    return updated;
  }

  // async update(
  //   storeId: number,
  //   id: number,
  //   data: Partial<{
  //     number: string;
  //     squareMeters: number;
  //     pricePerSqM: number;
  //     status: PavilionStatus;
  //     tenantName: string | null;
  //     rentAmount: number | null;
  //     utilitiesAmount: number | null;
  //   }>,
  // ) {
  //   await this.ensureExists(storeId, id);

  //   return this.prisma.pavilion.update({
  //     where: { id },
  //     data,
  //   });
  // }

  async delete(storeId: number, id: number, userId?: number) {
    await this.ensureExists(storeId, id);
    const pavilion = await this.prisma.pavilion.findUnique({
      where: { id },
      select: { id: true, number: true },
    });

    const contracts = await this.prisma.contract.findMany({
      where: { pavilionId: id },
      select: { filePath: true },
    });

    for (const contract of contracts) {
      const absolutePath = join(
        process.cwd(),
        contract.filePath.replace(/^\/+/, ''),
      );
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }

    const deleted = await this.prisma.pavilion.delete({
      where: { id },
    });
    await this.storeActivity.log({
      storeId,
      userId,
      pavilionId: id,
      action: 'DELETE',
      entityType: 'PAVILION',
      entityId: id,
      details: {
        number: pavilion?.number ?? deleted.number,
      },
    });
    return deleted;
  }

  private async ensureExists(storeId: number, id: number) {
    const exists = await this.prisma.pavilion.findFirst({
      where: { id, storeId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Pavilion not found');
    }
  }

  async listContracts(storeId: number, pavilionId: number) {
    await this.ensureExists(storeId, pavilionId);

    return this.prisma.contract.findMany({
      where: { pavilionId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async createContract(
    storeId: number,
    pavilionId: number,
    data: { fileName: string; filePath: string; fileType: string },
    userId?: number,
  ) {
    const pavilion = await this.prisma.pavilion.findFirst({
      where: { id: pavilionId, storeId },
      select: { id: true, number: true },
    });
    if (!pavilion) {
      throw new NotFoundException('Pavilion not found');
    }

    const created = await this.prisma.contract.create({
      data: {
        pavilionId,
        fileName: data.fileName,
        filePath: data.filePath,
        fileType: data.fileType,
      },
    });
    await this.storeActivity.log({
      storeId,
      userId,
      pavilionId,
      action: 'CREATE',
      entityType: 'CONTRACT',
      entityId: created.id,
      details: {
        pavilionNumber: pavilion.number,
        fileName: created.fileName,
        fileType: created.fileType,
      },
    });
    return created;
  }

  async deleteContract(
    storeId: number,
    pavilionId: number,
    contractId: number,
    userId?: number,
  ) {
    const pavilion = await this.prisma.pavilion.findFirst({
      where: { id: pavilionId, storeId },
      select: { id: true, number: true },
    });
    if (!pavilion) {
      throw new NotFoundException('Pavilion not found');
    }

    const contract = await this.prisma.contract.findFirst({
      where: {
        id: contractId,
        pavilionId,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const absolutePath = join(
      process.cwd(),
      contract.filePath.replace(/^\/+/, ''),
    );
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    const deleted = await this.prisma.contract.delete({
      where: { id: contractId },
    });
    await this.storeActivity.log({
      storeId,
      userId,
      pavilionId,
      action: 'DELETE',
      entityType: 'CONTRACT',
      entityId: deleted.id,
      details: {
        pavilionNumber: pavilion.number,
        fileName: deleted.fileName,
        fileType: deleted.fileType,
      },
    });
    return deleted;
  }

  private async syncExpiredPrepayments(storeId: number) {
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

  private async refreshMonthlyLedger(pavilionId: number, period: Date) {
    const normalizedPeriod = startOfMonth(period);
    const pavilion = await this.prisma.pavilion.findUnique({
      where: { id: pavilionId },
      include: {
        discounts: true,
        payments: {
          where: { period: normalizedPeriod },
        },
        additionalCharges: true,
      },
    });
    if (!pavilion) return;

    const previousPeriod = startOfMonth(
      new Date(normalizedPeriod.getFullYear(), normalizedPeriod.getMonth() - 1, 1),
    );
    const previousLedger = await this.prisma.pavilionMonthlyLedger.findUnique({
      where: {
        pavilionId_period: {
          pavilionId,
          period: previousPeriod,
        },
      },
      select: { closingDebt: true },
    });
    const openingDebt = previousLedger?.closingDebt ?? 0;

    const baseRent = Number(
      pavilion.rentAmount ?? pavilion.squareMeters * pavilion.pricePerSqM,
    );
    const monthlyDiscount =
      pavilion.status === PavilionStatus.PREPAID
        ? 0
        : this.getMonthlyDiscountTotal(
            pavilion.discounts,
            pavilion.squareMeters,
            normalizedPeriod,
          );
    const expectedRent =
      pavilion.status === PavilionStatus.PREPAID
        ? baseRent
        : pavilion.status === PavilionStatus.RENTED
          ? Math.max(baseRent - monthlyDiscount, 0)
          : 0;
    const expectedUtilities =
      pavilion.status === PavilionStatus.RENTED
        ? Number(pavilion.utilitiesAmount ?? 0)
        : 0;
    const expectedAdvertising =
      pavilion.status === PavilionStatus.RENTED
        ? Number(pavilion.advertisingAmount ?? 0)
        : 0;
    const expectedAdditional =
      pavilion.status === PavilionStatus.RENTED
        ? pavilion.additionalCharges.reduce((sum, charge) => sum + Number(charge.amount ?? 0), 0)
        : 0;
    const expectedTotal =
      expectedRent + expectedUtilities + expectedAdvertising + expectedAdditional;
    const actualTotal = pavilion.payments.reduce((sum, payment) => {
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
      const advertising = advertisingRaw > 0 ? advertisingRaw : advertisingChannels;
      return sum + rent + utilities + advertising;
    }, 0);
    const monthDelta = expectedTotal - actualTotal;
    const closingDebt = openingDebt + monthDelta;

    await this.prisma.pavilionMonthlyLedger.upsert({
      where: {
        pavilionId_period: {
          pavilionId,
          period: normalizedPeriod,
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
        pavilionId,
        period: normalizedPeriod,
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
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PavilionStatus, Prisma } from '@prisma/client';
import { CreatePavilionDto } from './dto/create-pavilion.dto';
import { endOfMonth, startOfMonth } from 'date-fns';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class PavilionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(storeId: number, dto: CreatePavilionDto) {
    const calculatedRent = dto.squareMeters * dto.pricePerSqM;
    const isPrepaid = dto.status === PavilionStatus.PREPAID;
    const parsedPrepaidUntil = dto.prepaidUntil
      ? endOfMonth(new Date(dto.prepaidUntil))
      : endOfMonth(new Date());

    const created = await this.prisma.pavilion.create({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: {
        ...dto,
        rentAmount: dto.rentAmount ?? calculatedRent,
        status: dto.status ?? PavilionStatus.AVAILABLE,
        prepaidUntil: isPrepaid ? parsedPrepaidUntil : null,
        store: { connect: { id: storeId } },
      },
    });
    await this.refreshMonthlyLedger(created.id, startOfMonth(new Date()));
    return created;
  }

  async findAll(storeId: number) {
    await this.syncExpiredPrepayments(storeId);

    return this.prisma.pavilion.findMany({
      where: { storeId },
      include: {
        additionalCharges: true,
        discounts: true,
        payments: true,
        contracts: true,
      },
    });
  }

async findOne(storeId: number, id: number) {
  await this.syncExpiredPrepayments(storeId);

  return this.prisma.pavilion.findFirst({
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
}

  async update(
    storeId: number,
    pavilionId: number,
    data: Prisma.PavilionUpdateInput,
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

  async delete(storeId: number, id: number) {
    await this.ensureExists(storeId, id);

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

    return this.prisma.pavilion.delete({
      where: { id },
    });
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
  ) {
    await this.ensureExists(storeId, pavilionId);

    return this.prisma.contract.create({
      data: {
        pavilionId,
        fileName: data.fileName,
        filePath: data.filePath,
        fileType: data.fileType,
      },
    });
  }

  async deleteContract(storeId: number, pavilionId: number, contractId: number) {
    await this.ensureExists(storeId, pavilionId);

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

    return this.prisma.contract.delete({
      where: { id: contractId },
    });
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

    const baseRent = pavilion.squareMeters * pavilion.pricePerSqM;
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
    const expectedAdditional =
      pavilion.status === PavilionStatus.RENTED
        ? pavilion.additionalCharges.reduce((sum, charge) => sum + Number(charge.amount ?? 0), 0)
        : 0;
    const expectedTotal = expectedRent + expectedUtilities + expectedAdditional;
    const actualTotal = pavilion.payments.reduce(
      (sum, payment) =>
        sum + Number(payment.rentPaid ?? 0) + Number(payment.utilitiesPaid ?? 0),
      0,
    );
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

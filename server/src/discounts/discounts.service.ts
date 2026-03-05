import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PavilionStatus } from '@prisma/client';
import { endOfMonth, startOfMonth } from 'date-fns';
import { PrismaService } from 'src/prisma/prisma.service';
import { StoreActivityService } from 'src/store-activity/store-activity.service';

@Injectable()
export class DiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeActivity: StoreActivityService,
  ) {}

  async list(pavilionId: number) {
    return this.prisma.pavilionDiscount.findMany({
      where: { pavilionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    pavilionId: number,
    data: { amount: number; startsAt: string; endsAt?: string; note?: string },
    userId?: number,
  ) {
    const startsAt = new Date(data.startsAt);
    const endsAt = data.endsAt ? new Date(data.endsAt) : null;

    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Invalid startsAt date');
    }

    if (endsAt && Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('Invalid endsAt date');
    }

    if (endsAt && endsAt < startsAt) {
      throw new BadRequestException('endsAt must be greater than or equal to startsAt');
    }

    const pavilion = await this.prisma.pavilion.findUnique({
      where: { id: pavilionId },
      select: { id: true, storeId: true, number: true },
    });

    if (!pavilion) {
      throw new NotFoundException('Pavilion not found');
    }

    const created = await this.prisma.pavilionDiscount.create({
      data: {
        pavilionId,
        amount: data.amount,
        startsAt,
        endsAt,
        note: data.note,
      },
    });
    await this.storeActivity.log({
      storeId: pavilion.storeId,
      userId,
      pavilionId,
      action: 'CREATE',
      entityType: 'DISCOUNT',
      entityId: created.id,
      details: {
        pavilionNumber: pavilion.number,
        amount: created.amount,
        startsAt: created.startsAt,
        endsAt: created.endsAt,
        note: created.note,
      },
    });
    await this.refreshRelevantPeriods(pavilionId, startsAt, endsAt ?? undefined);
    return created;
  }

  async delete(pavilionId: number, discountId: number, userId?: number) {
    const discount = await this.prisma.pavilionDiscount.findFirst({
      where: {
        id: discountId,
        pavilionId,
      },
      select: {
        id: true,
        amount: true,
        startsAt: true,
        endsAt: true,
        note: true,
        pavilion: { select: { storeId: true, number: true } },
      },
    });

    if (!discount) {
      throw new NotFoundException('Discount not found');
    }

    const deleted = await this.prisma.pavilionDiscount.delete({
      where: { id: discountId },
    });
    await this.storeActivity.log({
      storeId: discount.pavilion.storeId,
      userId,
      pavilionId,
      action: 'DELETE',
      entityType: 'DISCOUNT',
      entityId: deleted.id,
      details: {
        pavilionNumber: discount.pavilion.number,
        amount: discount.amount,
        startsAt: discount.startsAt,
        endsAt: discount.endsAt,
        note: discount.note,
      },
    });
    await this.refreshRelevantPeriods(
      pavilionId,
      discount.startsAt,
      discount.endsAt ?? undefined,
    );
    return deleted;
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

  private async refreshRelevantPeriods(
    pavilionId: number,
    startsAt: Date,
    endsAt?: Date,
  ) {
    const periods = new Set<number>([
      startOfMonth(new Date()).getTime(),
      startOfMonth(startsAt).getTime(),
    ]);
    if (endsAt) {
      periods.add(startOfMonth(endsAt).getTime());
    }
    for (const ts of periods) {
      await this.refreshMonthlyLedger(pavilionId, new Date(ts));
    }
  }

  private async refreshMonthlyLedger(pavilionId: number, period: Date) {
    const normalizedPeriod = startOfMonth(period);
    const monthStart = startOfMonth(normalizedPeriod);
    const monthEnd = endOfMonth(normalizedPeriod);

    const pavilion = await this.prisma.pavilion.findUnique({
      where: { id: pavilionId },
      include: {
        discounts: true,
        payments: {
          where: { period: normalizedPeriod },
        },
        additionalCharges: {
          where: {
            createdAt: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
          include: {
            payments: {
              where: {
                paidAt: {
                  gte: monthStart,
                  lte: monthEnd,
                },
              },
            },
          },
        },
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
        ? pavilion.additionalCharges.reduce(
            (sum, charge) => sum + Number(charge.amount ?? 0),
            0,
          )
        : 0;
    const expectedTotal =
      expectedRent + expectedUtilities + expectedAdvertising + expectedAdditional;

    const actualBase = pavilion.payments.reduce((sum, payment) => {
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
    const actualAdditional = pavilion.additionalCharges.reduce(
      (sum, charge) =>
        sum +
        charge.payments.reduce(
          (paymentSum, payment) => paymentSum + Number(payment.amountPaid ?? 0),
          0,
        ),
      0,
    );
    const actualTotal = actualBase + actualAdditional;
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
        monthDelta,
        openingDebt,
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
        monthDelta,
        openingDebt,
        closingDebt,
      },
    });
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { startOfMonth, endOfMonth } from 'date-fns';
import { PavilionStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async getMonthlySummary(pavilionId: number, period: Date) {
    const normalizedPeriod = startOfMonth(period);
    const start = startOfMonth(normalizedPeriod);
    const end = endOfMonth(normalizedPeriod);

    const pavilion = await this.prisma.pavilion.findUnique({
      where: { id: pavilionId },
      include: {
        additionalCharges: {
          include: {
            payments: {
              where: {
                paidAt: {
                  gte: start,
                  lte: end,
                },
              },
            },
          },
        },
        discounts: true,
        payments: {
          where: {
            period: normalizedPeriod,
          },
        },
      },
    });

    if (!pavilion) {
      throw new NotFoundException('Pavilion not found');
    }

    const pavilionStatus = await this.normalizePrepaidStatus(pavilion);
    const ledger = await this.refreshMonthlyLedger(pavilionId, normalizedPeriod, pavilionStatus);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const payment = pavilion.payments[0]; // one payment per month

    /* ======================
      EXPECTED AMOUNTS
    ====================== */

    const baseRent = pavilion.squareMeters * pavilion.pricePerSqM;
    const monthlyDiscount = this.getMonthlyDiscountTotal(
      pavilion.discounts,
      pavilion.squareMeters,
      normalizedPeriod,
    );
    const expectedRent = ledger.expectedRent;
    const expectedUtilities = ledger.expectedUtilities;
    const expectedAdvertising = ledger.expectedAdvertising;
    const expectedAdditional = ledger.expectedAdditional;
    const expectedTotal = ledger.expectedTotal;

    /* ======================
      PAID AMOUNTS
    ====================== */

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const paidRent = payment?.rentPaid ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const paidUtilities =
      pavilionStatus === PavilionStatus.PREPAID ? 0 : (payment?.utilitiesPaid ?? 0);
    const paidAdvertising =
      pavilionStatus === PavilionStatus.PREPAID ? 0 : (payment?.advertisingPaid ?? 0);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const paidAdditional =
      pavilionStatus === PavilionStatus.PREPAID
        ? 0
        : pavilion.additionalCharges.reduce(
            (sum, charge) =>
              sum + charge.payments.reduce((pSum, p) => pSum + p.amountPaid, 0),
            0,
          );

    const paidTotal = paidRent + paidUtilities + paidAdvertising + paidAdditional;

    /* ======================
      RESULT
    ====================== */

    return {
      period: normalizedPeriod,
      expected: {
        baseRent,
        discount: pavilionStatus === PavilionStatus.PREPAID ? 0 : monthlyDiscount,
        rent: expectedRent,
        utilities: expectedUtilities,
        advertising: expectedAdvertising,
        additional: expectedAdditional,
        total: expectedTotal,
      },
      paid: {
        rent: paidRent,
        utilities: paidUtilities,
        advertising: paidAdvertising,
        additional: paidAdditional,
        total: paidTotal,
      },
      balance: expectedTotal - paidTotal,
      debt: {
        opening: ledger.openingDebt,
        monthDelta: ledger.monthDelta,
        closing: ledger.closingDebt,
      },
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

  //Create/Update payment record for a month
async addPayment(
  pavilionId: number,
  period: Date,
  data: {
    rentPaid?: number;
    utilitiesPaid?: number;
    advertisingPaid?: number;
    bankTransferPaid?: number;
    cashbox1Paid?: number;
    cashbox2Paid?: number;
    rentBankTransferPaid?: number;
    rentCashbox1Paid?: number;
    rentCashbox2Paid?: number;
    utilitiesBankTransferPaid?: number;
    utilitiesCashbox1Paid?: number;
    utilitiesCashbox2Paid?: number;
    advertisingBankTransferPaid?: number;
    advertisingCashbox1Paid?: number;
    advertisingCashbox2Paid?: number;
  },
) {
  const normalizedPeriod = startOfMonth(period);
  const hasLegacyRentChannels =
    data.bankTransferPaid !== undefined ||
    data.cashbox1Paid !== undefined ||
    data.cashbox2Paid !== undefined;

  const rentBank = data.rentBankTransferPaid ?? data.bankTransferPaid ?? 0;
  const rentCashbox1 = data.rentCashbox1Paid ?? data.cashbox1Paid ?? 0;
  const rentCashbox2 = data.rentCashbox2Paid ?? data.cashbox2Paid ?? 0;
  const hasRentChannelInput =
    hasLegacyRentChannels ||
    data.rentBankTransferPaid !== undefined ||
    data.rentCashbox1Paid !== undefined ||
    data.rentCashbox2Paid !== undefined;
  const rentByChannels = rentBank + rentCashbox1 + rentCashbox2;
  const rentIncrement = hasRentChannelInput ? rentByChannels : (data.rentPaid ?? 0);

  const utilitiesBank = data.utilitiesBankTransferPaid ?? 0;
  const utilitiesCashbox1 = data.utilitiesCashbox1Paid ?? 0;
  const utilitiesCashbox2 = data.utilitiesCashbox2Paid ?? 0;
  const hasUtilitiesChannelInput =
    data.utilitiesBankTransferPaid !== undefined ||
    data.utilitiesCashbox1Paid !== undefined ||
    data.utilitiesCashbox2Paid !== undefined;
  const utilitiesByChannels = utilitiesBank + utilitiesCashbox1 + utilitiesCashbox2;
  const utilitiesIncrement = hasUtilitiesChannelInput
    ? utilitiesByChannels
    : (data.utilitiesPaid ?? 0);

  const advertisingBank = data.advertisingBankTransferPaid ?? 0;
  const advertisingCashbox1 = data.advertisingCashbox1Paid ?? 0;
  const advertisingCashbox2 = data.advertisingCashbox2Paid ?? 0;
  const hasAdvertisingChannelInput =
    data.advertisingBankTransferPaid !== undefined ||
    data.advertisingCashbox1Paid !== undefined ||
    data.advertisingCashbox2Paid !== undefined;
  const advertisingByChannels =
    advertisingBank + advertisingCashbox1 + advertisingCashbox2;
  const advertisingIncrement = hasAdvertisingChannelInput
    ? advertisingByChannels
    : (data.advertisingPaid ?? 0);

  if (hasRentChannelInput && data.rentPaid !== undefined) {
    const diff = Math.abs(data.rentPaid - rentByChannels);
    if (diff > 0.01) {
      throw new BadRequestException(
        'Rent amount must equal selected payment channels total',
      );
    }
  }
  if (hasUtilitiesChannelInput && data.utilitiesPaid !== undefined) {
    const diff = Math.abs(data.utilitiesPaid - utilitiesByChannels);
    if (diff > 0.01) {
      throw new BadRequestException(
        'Utilities amount must equal selected payment channels total',
      );
    }
  }
  if (hasAdvertisingChannelInput && data.advertisingPaid !== undefined) {
    const diff = Math.abs(data.advertisingPaid - advertisingByChannels);
    if (diff > 0.01) {
      throw new BadRequestException(
        'Advertising amount must equal selected payment channels total',
      );
    }
  }

  const channelBank = rentBank + utilitiesBank + advertisingBank;
  const channelCashbox1 = rentCashbox1 + utilitiesCashbox1 + advertisingCashbox1;
  const channelCashbox2 = rentCashbox2 + utilitiesCashbox2 + advertisingCashbox2;

  if (
    rentIncrement < 0 ||
    utilitiesIncrement < 0 ||
    advertisingIncrement < 0 ||
    rentBank < 0 ||
    rentCashbox1 < 0 ||
    rentCashbox2 < 0 ||
    utilitiesBank < 0 ||
    utilitiesCashbox1 < 0 ||
    utilitiesCashbox2 < 0 ||
    advertisingBank < 0 ||
    advertisingCashbox1 < 0 ||
    advertisingCashbox2 < 0 ||
    channelBank < 0 ||
    channelCashbox1 < 0 ||
    channelCashbox2 < 0
  ) {
    throw new BadRequestException('Payment amounts must be non-negative');
  }

  const pavilion = await this.prisma.pavilion.findUnique({
    where: { id: pavilionId },
    select: {
      id: true,
      status: true,
      prepaidUntil: true,
    },
  });

  if (!pavilion) {
    throw new NotFoundException('Pavilion not found');
  }

  const normalizedStatus = await this.normalizePrepaidStatus(pavilion);

  if (normalizedStatus === PavilionStatus.PREPAID) {
    const prepaidMonth = startOfMonth(pavilion.prepaidUntil ?? new Date());

    if (normalizedPeriod.getTime() !== prepaidMonth.getTime()) {
      throw new BadRequestException(
        'For PREPAID pavilion, payment is allowed only for the first prepaid month',
      );
    }

    if (utilitiesIncrement > 0 || advertisingIncrement > 0) {
      throw new BadRequestException(
        'Utilities and advertising cannot be paid while pavilion status is PREPAID',
      );
    }
  }

  const safeUtilitiesIncrement =
    normalizedStatus === PavilionStatus.PREPAID ? 0 : utilitiesIncrement;
  const safeAdvertisingIncrement =
    normalizedStatus === PavilionStatus.PREPAID ? 0 : advertisingIncrement;
  const safeUtilitiesBank = normalizedStatus === PavilionStatus.PREPAID ? 0 : utilitiesBank;
  const safeUtilitiesCashbox1 =
    normalizedStatus === PavilionStatus.PREPAID ? 0 : utilitiesCashbox1;
  const safeUtilitiesCashbox2 =
    normalizedStatus === PavilionStatus.PREPAID ? 0 : utilitiesCashbox2;
  const safeAdvertisingBank =
    normalizedStatus === PavilionStatus.PREPAID ? 0 : advertisingBank;
  const safeAdvertisingCashbox1 =
    normalizedStatus === PavilionStatus.PREPAID ? 0 : advertisingCashbox1;
  const safeAdvertisingCashbox2 =
    normalizedStatus === PavilionStatus.PREPAID ? 0 : advertisingCashbox2;
  const safeChannelBank = rentBank + safeUtilitiesBank + safeAdvertisingBank;
  const safeChannelCashbox1 = rentCashbox1 + safeUtilitiesCashbox1 + safeAdvertisingCashbox1;
  const safeChannelCashbox2 = rentCashbox2 + safeUtilitiesCashbox2 + safeAdvertisingCashbox2;

  const payment = await this.prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({
      where: {
        pavilionId_period: { pavilionId, period: normalizedPeriod },
      },
    });

    const payment = existing
      ? await tx.payment.update({
          where: { id: existing.id },
          data: {
            rentPaid: { increment: rentIncrement },
            utilitiesPaid: { increment: safeUtilitiesIncrement },
            advertisingPaid: { increment: safeAdvertisingIncrement },
            bankTransferPaid: { increment: safeChannelBank },
            cashbox1Paid: { increment: safeChannelCashbox1 },
            cashbox2Paid: { increment: safeChannelCashbox2 },
            rentBankTransferPaid: { increment: rentBank },
            rentCashbox1Paid: { increment: rentCashbox1 },
            rentCashbox2Paid: { increment: rentCashbox2 },
            utilitiesBankTransferPaid: { increment: safeUtilitiesBank },
            utilitiesCashbox1Paid: { increment: safeUtilitiesCashbox1 },
            utilitiesCashbox2Paid: { increment: safeUtilitiesCashbox2 },
            advertisingBankTransferPaid: { increment: safeAdvertisingBank },
            advertisingCashbox1Paid: { increment: safeAdvertisingCashbox1 },
            advertisingCashbox2Paid: { increment: safeAdvertisingCashbox2 },
          },
        })
      : await tx.payment.create({
          data: {
            pavilionId,
            period: normalizedPeriod,
            rentPaid: rentIncrement,
            utilitiesPaid: safeUtilitiesIncrement,
            advertisingPaid: safeAdvertisingIncrement,
            bankTransferPaid: safeChannelBank,
            cashbox1Paid: safeChannelCashbox1,
            cashbox2Paid: safeChannelCashbox2,
            rentBankTransferPaid: rentBank,
            rentCashbox1Paid: rentCashbox1,
            rentCashbox2Paid: rentCashbox2,
            utilitiesBankTransferPaid: safeUtilitiesBank,
            utilitiesCashbox1Paid: safeUtilitiesCashbox1,
            utilitiesCashbox2Paid: safeUtilitiesCashbox2,
            advertisingBankTransferPaid: safeAdvertisingBank,
            advertisingCashbox1Paid: safeAdvertisingCashbox1,
            advertisingCashbox2Paid: safeAdvertisingCashbox2,
          },
        });

    await tx.paymentTransaction.create({
      data: {
        pavilionId,
        paymentId: payment.id,
        period: normalizedPeriod,
        rentPaid: rentIncrement,
        utilitiesPaid: safeUtilitiesIncrement,
        advertisingPaid: safeAdvertisingIncrement,
        bankTransferPaid: safeChannelBank,
        cashbox1Paid: safeChannelCashbox1,
        cashbox2Paid: safeChannelCashbox2,
        rentBankTransferPaid: rentBank,
        rentCashbox1Paid: rentCashbox1,
        rentCashbox2Paid: rentCashbox2,
        utilitiesBankTransferPaid: safeUtilitiesBank,
        utilitiesCashbox1Paid: safeUtilitiesCashbox1,
        utilitiesCashbox2Paid: safeUtilitiesCashbox2,
        advertisingBankTransferPaid: safeAdvertisingBank,
        advertisingCashbox1Paid: safeAdvertisingCashbox1,
        advertisingCashbox2Paid: safeAdvertisingCashbox2,
      },
    });

    return payment;
  });
  await this.refreshMonthlyLedger(pavilionId, normalizedPeriod, normalizedStatus);
  return payment;
}

  list(pavilionId: number) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return this.prisma.payment.findMany({
      where: { pavilionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteEntry(pavilionId: number, entryId: number) {
    const result = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.paymentTransaction.findFirst({
        where: { id: entryId, pavilionId },
      });

      if (!entry) {
        throw new NotFoundException('Payment entry not found');
      }

      const payment = await tx.payment.findUnique({
        where: {
          pavilionId_period: { pavilionId, period: entry.period },
        },
      });

      if (payment) {
        const nextRent = (payment.rentPaid ?? 0) - entry.rentPaid;
        const nextUtilities = (payment.utilitiesPaid ?? 0) - entry.utilitiesPaid;
        const nextAdvertising = (payment.advertisingPaid ?? 0) - entry.advertisingPaid;
        const nextBank = (payment.bankTransferPaid ?? 0) - entry.bankTransferPaid;
        const nextCashbox1 = (payment.cashbox1Paid ?? 0) - entry.cashbox1Paid;
        const nextCashbox2 = (payment.cashbox2Paid ?? 0) - entry.cashbox2Paid;
        const nextRentBank =
          (payment.rentBankTransferPaid ?? 0) - (entry.rentBankTransferPaid ?? 0);
        const nextRentCashbox1 =
          (payment.rentCashbox1Paid ?? 0) - (entry.rentCashbox1Paid ?? 0);
        const nextRentCashbox2 =
          (payment.rentCashbox2Paid ?? 0) - (entry.rentCashbox2Paid ?? 0);
        const nextUtilitiesBank =
          (payment.utilitiesBankTransferPaid ?? 0) - (entry.utilitiesBankTransferPaid ?? 0);
        const nextUtilitiesCashbox1 =
          (payment.utilitiesCashbox1Paid ?? 0) - (entry.utilitiesCashbox1Paid ?? 0);
        const nextUtilitiesCashbox2 =
          (payment.utilitiesCashbox2Paid ?? 0) - (entry.utilitiesCashbox2Paid ?? 0);
        const nextAdvertisingBank =
          (payment.advertisingBankTransferPaid ?? 0) - (entry.advertisingBankTransferPaid ?? 0);
        const nextAdvertisingCashbox1 =
          (payment.advertisingCashbox1Paid ?? 0) - (entry.advertisingCashbox1Paid ?? 0);
        const nextAdvertisingCashbox2 =
          (payment.advertisingCashbox2Paid ?? 0) - (entry.advertisingCashbox2Paid ?? 0);

        const shouldDeleteAggregate =
          Math.abs(nextRent) < 0.01 &&
          Math.abs(nextUtilities) < 0.01 &&
          Math.abs(nextAdvertising) < 0.01 &&
          Math.abs(nextBank) < 0.01 &&
          Math.abs(nextCashbox1) < 0.01 &&
          Math.abs(nextCashbox2) < 0.01 &&
          Math.abs(nextRentBank) < 0.01 &&
          Math.abs(nextRentCashbox1) < 0.01 &&
          Math.abs(nextRentCashbox2) < 0.01 &&
          Math.abs(nextUtilitiesBank) < 0.01 &&
          Math.abs(nextUtilitiesCashbox1) < 0.01 &&
          Math.abs(nextUtilitiesCashbox2) < 0.01 &&
          Math.abs(nextAdvertisingBank) < 0.01 &&
          Math.abs(nextAdvertisingCashbox1) < 0.01 &&
          Math.abs(nextAdvertisingCashbox2) < 0.01;

        if (shouldDeleteAggregate) {
          await tx.payment.delete({ where: { id: payment.id } });
        } else {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              rentPaid: nextRent,
              utilitiesPaid: nextUtilities,
              advertisingPaid: nextAdvertising,
              bankTransferPaid: nextBank,
              cashbox1Paid: nextCashbox1,
              cashbox2Paid: nextCashbox2,
              rentBankTransferPaid: nextRentBank,
              rentCashbox1Paid: nextRentCashbox1,
              rentCashbox2Paid: nextRentCashbox2,
              utilitiesBankTransferPaid: nextUtilitiesBank,
              utilitiesCashbox1Paid: nextUtilitiesCashbox1,
              utilitiesCashbox2Paid: nextUtilitiesCashbox2,
              advertisingBankTransferPaid: nextAdvertisingBank,
              advertisingCashbox1Paid: nextAdvertisingCashbox1,
              advertisingCashbox2Paid: nextAdvertisingCashbox2,
            },
          });
        }
      }

      await tx.paymentTransaction.delete({
        where: { id: entryId },
      });

      return { period: entry.period };
    });

    const normalizedPeriod = startOfMonth(result.period);
    await this.refreshMonthlyLedger(pavilionId, normalizedPeriod);
    return { success: true };
  }

  private async normalizePrepaidStatus(pavilion: {
    id: number;
    status: PavilionStatus;
    prepaidUntil?: Date | null;
  }) {
    if (
      pavilion.status === PavilionStatus.PREPAID &&
      pavilion.prepaidUntil &&
      pavilion.prepaidUntil < startOfMonth(new Date())
    ) {
      await this.prisma.pavilion.update({
        where: { id: pavilion.id },
        data: {
          status: PavilionStatus.RENTED,
          prepaidUntil: null,
        },
      });

      return PavilionStatus.RENTED;
    }

    return pavilion.status;
  }

  private async refreshMonthlyLedger(
    pavilionId: number,
    period: Date,
    normalizedStatus?: PavilionStatus,
  ) {
    const normalizedPeriod = startOfMonth(period);
    const start = startOfMonth(normalizedPeriod);
    const end = endOfMonth(normalizedPeriod);
    const pavilion = await this.prisma.pavilion.findUnique({
      where: { id: pavilionId },
      include: {
        discounts: true,
        payments: {
          where: {
            period: normalizedPeriod,
          },
        },
        additionalCharges: {
          where: {
            createdAt: {
              gte: start,
              lte: end,
            },
          },
          include: {
            payments: {
              where: {
                paidAt: {
                  gte: start,
                  lte: end,
                },
              },
            },
          },
        },
      },
    });

    if (!pavilion) {
      throw new NotFoundException('Pavilion not found');
    }

    const pavilionStatus = normalizedStatus ?? (await this.normalizePrepaidStatus(pavilion));
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
    const monthlyDiscount = this.getMonthlyDiscountTotal(
      pavilion.discounts,
      pavilion.squareMeters,
      normalizedPeriod,
    );
    const expectedRent =
      pavilionStatus === PavilionStatus.PREPAID
        ? baseRent
        : pavilionStatus === PavilionStatus.RENTED
          ? Math.max(baseRent - monthlyDiscount, 0)
          : 0;
    const expectedUtilities =
      pavilionStatus === PavilionStatus.RENTED ? Number(pavilion.utilitiesAmount ?? 0) : 0;
    const expectedAdvertising =
      pavilionStatus === PavilionStatus.RENTED ? Number(pavilion.advertisingAmount ?? 0) : 0;
    const expectedAdditional =
      pavilionStatus === PavilionStatus.RENTED
        ? pavilion.additionalCharges.reduce((sum, charge) => sum + Number(charge.amount ?? 0), 0)
        : 0;
    const expectedTotal =
      expectedRent + expectedUtilities + expectedAdvertising + expectedAdditional;

    const actualRentAndUtilities = pavilion.payments.reduce(
      (sum, pay) =>
        sum +
        Number(pay.rentPaid ?? 0) +
        Number(pay.utilitiesPaid ?? 0) +
        Number(pay.advertisingPaid ?? 0),
      0,
    );
    const actualAdditional = pavilion.additionalCharges.reduce(
      (sum, charge) =>
        sum +
        charge.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amountPaid ?? 0), 0),
      0,
    );
    const actualTotal = actualRentAndUtilities + actualAdditional;
    const monthDelta = expectedTotal - actualTotal;
    const closingDebt = openingDebt + monthDelta;

    return this.prisma.pavilionMonthlyLedger.upsert({
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

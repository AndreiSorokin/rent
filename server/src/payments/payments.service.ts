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
    const expectedRent =
      pavilionStatus === PavilionStatus.PREPAID
        ? baseRent
        : Math.max(baseRent - monthlyDiscount, 0);
    const expectedUtilities =
      pavilionStatus === PavilionStatus.PREPAID
        ? 0
        : (pavilion.utilitiesAmount ?? 0);

    const expectedAdditional =
      pavilionStatus === PavilionStatus.PREPAID
        ? 0
        : pavilion.additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);

    const expectedTotal = expectedRent + expectedUtilities + expectedAdditional;

    /* ======================
      PAID AMOUNTS
    ====================== */

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const paidRent = payment?.rentPaid ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const paidUtilities =
      pavilionStatus === PavilionStatus.PREPAID ? 0 : (payment?.utilitiesPaid ?? 0);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const paidAdditional =
      pavilionStatus === PavilionStatus.PREPAID
        ? 0
        : pavilion.additionalCharges.reduce(
            (sum, charge) =>
              sum + charge.payments.reduce((pSum, p) => pSum + p.amountPaid, 0),
            0,
          );

    const paidTotal = paidRent + paidUtilities + paidAdditional;

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
        additional: expectedAdditional,
        total: expectedTotal,
      },
      paid: {
        rent: paidRent,
        utilities: paidUtilities,
        additional: paidAdditional,
        total: paidTotal,
      },
      balance: expectedTotal - paidTotal,
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
    bankTransferPaid?: number;
    cashbox1Paid?: number;
    cashbox2Paid?: number;
  },
) {
  const normalizedPeriod = startOfMonth(period);
  const channelBank = data.bankTransferPaid ?? 0;
  const channelCashbox1 = data.cashbox1Paid ?? 0;
  const channelCashbox2 = data.cashbox2Paid ?? 0;
  const hasChannelInput =
    data.bankTransferPaid !== undefined ||
    data.cashbox1Paid !== undefined ||
    data.cashbox2Paid !== undefined;
  const channelRentTotal = channelBank + channelCashbox1 + channelCashbox2;
  const rentIncrement = hasChannelInput
    ? channelRentTotal
    : (data.rentPaid ?? 0);
  const utilitiesIncrement = data.utilitiesPaid ?? 0;

  if (hasChannelInput && data.rentPaid !== undefined) {
    const diff = Math.abs(data.rentPaid - channelRentTotal);
    if (diff > 0.01) {
      throw new BadRequestException(
        'Rent amount must equal selected payment channels total',
      );
    }
  }

  if (
    rentIncrement < 0 ||
    utilitiesIncrement < 0 ||
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

    if (utilitiesIncrement > 0) {
      throw new BadRequestException(
        'Utilities cannot be paid while pavilion status is PREPAID',
      );
    }
  }

  const safeUtilitiesIncrement =
    normalizedStatus === PavilionStatus.PREPAID ? 0 : utilitiesIncrement;

  return this.prisma.$transaction(async (tx) => {
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
            bankTransferPaid: { increment: channelBank },
            cashbox1Paid: { increment: channelCashbox1 },
            cashbox2Paid: { increment: channelCashbox2 },
          },
        })
      : await tx.payment.create({
          data: {
            pavilionId,
            period: normalizedPeriod,
            rentPaid: rentIncrement,
            utilitiesPaid: safeUtilitiesIncrement,
            bankTransferPaid: channelBank,
            cashbox1Paid: channelCashbox1,
            cashbox2Paid: channelCashbox2,
          },
        });

    await tx.paymentTransaction.create({
      data: {
        pavilionId,
        paymentId: payment.id,
        period: normalizedPeriod,
        rentPaid: rentIncrement,
        utilitiesPaid: safeUtilitiesIncrement,
        bankTransferPaid: channelBank,
        cashbox1Paid: channelCashbox1,
        cashbox2Paid: channelCashbox2,
      },
    });

    return payment;
  });
}

  list(pavilionId: number) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return this.prisma.payment.findMany({
      where: { pavilionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteEntry(pavilionId: number, entryId: number) {
    return this.prisma.$transaction(async (tx) => {
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
        const nextBank = (payment.bankTransferPaid ?? 0) - entry.bankTransferPaid;
        const nextCashbox1 = (payment.cashbox1Paid ?? 0) - entry.cashbox1Paid;
        const nextCashbox2 = (payment.cashbox2Paid ?? 0) - entry.cashbox2Paid;

        const shouldDeleteAggregate =
          Math.abs(nextRent) < 0.01 &&
          Math.abs(nextUtilities) < 0.01 &&
          Math.abs(nextBank) < 0.01 &&
          Math.abs(nextCashbox1) < 0.01 &&
          Math.abs(nextCashbox2) < 0.01;

        if (shouldDeleteAggregate) {
          await tx.payment.delete({ where: { id: payment.id } });
        } else {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              rentPaid: nextRent,
              utilitiesPaid: nextUtilities,
              bankTransferPaid: nextBank,
              cashbox1Paid: nextCashbox1,
              cashbox2Paid: nextCashbox2,
            },
          });
        }
      }

      return tx.paymentTransaction.delete({
        where: { id: entryId },
      });
    });
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
}

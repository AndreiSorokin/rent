import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PavilionStatus } from '@prisma/client';
import { endOfMonth, startOfMonth } from 'date-fns';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AdditionalChargeService {
  constructor(private prisma: PrismaService) {}

  async deletePayment(
    pavilionId: number,
    additionalChargeId: number,
    paymentId: number,
  ) {
    // Ensure payment belongs to the charge, and charge belongs to the pavilion
    const payment = await this.prisma.additionalChargePayment.findFirst({
      where: {
        id: paymentId,
        additionalChargeId,
        additionalCharge: { pavilionId },
      },
      select: {
        id: true,
        paidAt: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const deleted = await this.prisma.additionalChargePayment.delete({
      where: { id: paymentId },
    });

    await this.refreshMonthlyLedger(pavilionId, payment.paidAt);
    return deleted;
  }


  async payCharge(
    additionalChargeId: number,
    amountPaid: number,
    channels?: {
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    },
  ) {
    const charge = await this.prisma.additionalCharge.findUnique({
      where: { id: additionalChargeId },
    });

    if (!charge) {
      throw new NotFoundException('Additional charge not found');
    }
    const bankTransferPaid = Number(channels?.bankTransferPaid ?? 0);
    const cashbox1Paid = Number(channels?.cashbox1Paid ?? 0);
    const cashbox2Paid = Number(channels?.cashbox2Paid ?? 0);
    const hasChannelsInput =
      channels?.bankTransferPaid !== undefined ||
      channels?.cashbox1Paid !== undefined ||
      channels?.cashbox2Paid !== undefined;
    const channelsTotal = bankTransferPaid + cashbox1Paid + cashbox2Paid;

    if (
      Number.isNaN(amountPaid) ||
      amountPaid <= 0 ||
      bankTransferPaid < 0 ||
      cashbox1Paid < 0 ||
      cashbox2Paid < 0
    ) {
      throw new BadRequestException('Payment amounts must be valid and non-negative');
    }

    if (hasChannelsInput && Math.abs(channelsTotal - amountPaid) > 0.01) {
      throw new BadRequestException(
        'Additional charge amount must equal selected payment channels total',
      );
    }

    const created = await this.prisma.additionalChargePayment.create({
      data: {
        additionalChargeId,
        amountPaid,
        bankTransferPaid: hasChannelsInput ? bankTransferPaid : amountPaid,
        cashbox1Paid: hasChannelsInput ? cashbox1Paid : 0,
        cashbox2Paid: hasChannelsInput ? cashbox2Paid : 0,
      },
    });

    await this.refreshMonthlyLedger(charge.pavilionId, created.paidAt);
    return created;
  }

  async listPayments(additionalChargeId: number) {
    return this.prisma.additionalChargePayment.findMany({
      where: { additionalChargeId },
      orderBy: { paidAt: 'asc' },
    });
  }

  async create(pavilionId: number, data: { name: string; amount: number }) {
    const created = await this.prisma.additionalCharge.create({
      data: {
        name: data.name,
        amount: data.amount,
        pavilionId,
      },
    });
    await this.refreshMonthlyLedger(pavilionId, created.createdAt);
    return created;
  }

  findAll(pavilionId: number) {
    return this.prisma.additionalCharge.findMany({
      where: { pavilionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(
    pavilionId: number,
    chargeId: number,
    data: { name?: string; amount?: number },
  ) {
    const charge = await this.prisma.additionalCharge.findFirst({
      where: { id: chargeId, pavilionId },
    });

    if (!charge) {
      throw new NotFoundException('Additional charge not found');
    }

    const updated = await this.prisma.additionalCharge.update({
      where: { id: chargeId },
      data,
    });
    await this.refreshMonthlyLedger(pavilionId, updated.createdAt);
    return updated;
  }

  async delete(pavilionId: number, chargeId: number) {
    const charge = await this.prisma.additionalCharge.findFirst({
      where: { id: chargeId, pavilionId },
    });

    if (!charge) {
      throw new NotFoundException('Additional charge not found');
    }

    const deleted = await this.prisma.additionalCharge.delete({
      where: { id: chargeId },
    });
    await this.refreshMonthlyLedger(pavilionId, deleted.createdAt);
    return deleted;
  }

  async updatePayment(
    pavilionId: number,
    additionalChargeId: number,
    paymentId: number,
    data: {
      amountPaid?: number;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    },
  ) {
    const payment = await this.prisma.additionalChargePayment.findFirst({
      where: {
        id: paymentId,
        additionalChargeId,
        additionalCharge: { pavilionId },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const nextAmountPaid = Number(data.amountPaid ?? payment.amountPaid ?? 0);
    const nextBankTransferPaid = Number(
      data.bankTransferPaid ?? payment.bankTransferPaid ?? 0,
    );
    const nextCashbox1Paid = Number(data.cashbox1Paid ?? payment.cashbox1Paid ?? 0);
    const nextCashbox2Paid = Number(data.cashbox2Paid ?? payment.cashbox2Paid ?? 0);

    if (
      Number.isNaN(nextAmountPaid) ||
      Number.isNaN(nextBankTransferPaid) ||
      Number.isNaN(nextCashbox1Paid) ||
      Number.isNaN(nextCashbox2Paid) ||
      nextAmountPaid < 0 ||
      nextBankTransferPaid < 0 ||
      nextCashbox1Paid < 0 ||
      nextCashbox2Paid < 0
    ) {
      throw new BadRequestException('Payment amounts must be valid and non-negative');
    }

    const channelsTotal =
      nextBankTransferPaid + nextCashbox1Paid + nextCashbox2Paid;
    if (Math.abs(channelsTotal - nextAmountPaid) > 0.01) {
      throw new BadRequestException(
        'Additional charge amount must equal selected payment channels total',
      );
    }

    const updated = await this.prisma.additionalChargePayment.update({
      where: { id: paymentId },
      data: {
        amountPaid: nextAmountPaid,
        bankTransferPaid: nextBankTransferPaid,
        cashbox1Paid: nextCashbox1Paid,
        cashbox2Paid: nextCashbox2Paid,
      },
    });

    await this.refreshMonthlyLedger(pavilionId, updated.paidAt);
    return updated;
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
    const actualBase = pavilion.payments.reduce(
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

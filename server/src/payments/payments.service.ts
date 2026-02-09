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
  data: { rentPaid?: number; utilitiesPaid?: number },
) {
  const normalizedPeriod = startOfMonth(period);

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

    if ((data.utilitiesPaid ?? 0) > 0) {
      throw new BadRequestException(
        'Utilities cannot be paid while pavilion status is PREPAID',
      );
    }
  }

  const existing = await this.prisma.payment.findUnique({
    where: {
      pavilionId_period: { pavilionId, period: normalizedPeriod },
    },
  });

  if (existing) {
    return this.prisma.payment.update({
      where: { id: existing.id },
      data: {
        rentPaid: { increment: data.rentPaid || 0 },
        utilitiesPaid: {
          increment:
            normalizedStatus === PavilionStatus.PREPAID
              ? 0
              : (data.utilitiesPaid || 0),
        },
      },
    });
  }

  return this.prisma.payment.create({
    data: {
      pavilionId,
      period: normalizedPeriod,
      rentPaid: data.rentPaid || 0,
      utilitiesPaid:
        normalizedStatus === PavilionStatus.PREPAID
          ? 0
          : (data.utilitiesPaid || 0),
    },
  });
}

  list(pavilionId: number) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return this.prisma.payment.findMany({
      where: { pavilionId },
      orderBy: { createdAt: 'desc' },
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

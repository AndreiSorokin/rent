import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { startOfMonth, endOfMonth } from 'date-fns';

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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const payment = pavilion.payments[0]; // one payment per month

    /* ======================
      EXPECTED AMOUNTS
    ====================== */

    const baseRent = pavilion.squareMeters * pavilion.pricePerSqM;
    const monthlyDiscount = this.getMonthlyDiscountTotal(
      pavilion.discounts,
      normalizedPeriod,
    );
    const expectedRent = Math.max(baseRent - monthlyDiscount, 0);
    const expectedUtilities = pavilion.utilitiesAmount ?? 0;

    const expectedAdditional = pavilion.additionalCharges.reduce(
      (sum, charge) => sum + charge.amount,
      0,
    );

    const expectedTotal = expectedRent + expectedUtilities + expectedAdditional;

    /* ======================
      PAID AMOUNTS
    ====================== */

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const paidRent = payment?.rentPaid ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const paidUtilities = payment?.utilitiesPaid ?? 0;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const paidAdditional = pavilion.additionalCharges.reduce(
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
        discount: monthlyDiscount,
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
    period: Date,
  ) {
    const monthStart = startOfMonth(period);
    const monthEnd = endOfMonth(period);

    return discounts.reduce((sum, discount) => {
      const startsBeforeMonthEnds = discount.startsAt <= monthEnd;
      const endsAfterMonthStarts =
        discount.endsAt === null || discount.endsAt >= monthStart;

      if (startsBeforeMonthEnds && endsAfterMonthStarts) {
        return sum + discount.amount;
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
        utilitiesPaid: { increment: data.utilitiesPaid || 0 },
      },
    });
  }

  return this.prisma.payment.create({
    data: {
      pavilionId,
      period: normalizedPeriod,
      rentPaid: data.rentPaid || 0,
      utilitiesPaid: data.utilitiesPaid || 0,
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
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { endOfMonth, startOfMonth } from 'date-fns';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getStoreAnalytics(storeId: number) {
    const period = startOfMonth(new Date());
    const periodStart = startOfMonth(period);
    const periodEnd = endOfMonth(period);

    const pavilions = await this.prisma.pavilion.findMany({
      where: { storeId },
      include: {
        payments: {
          where: { period },
        },
        discounts: true,
        additionalCharges: {
          include: {
            payments: {
              where: {
                paidAt: {
                  gte: periodStart,
                  lte: periodEnd,
                },
              },
            },
          },
        },
      },
    });

    let expectedDiscount = 0;
    let expectedRent = 0;
    let expectedUtilities = 0;
    let expectedAdditional = 0;

    let paidRent = 0;
    let paidUtilities = 0;
    let paidAdditional = 0;

    for (const p of pavilions) {
      const baseRent = p.squareMeters * p.pricePerSqM;
      const pavilionDiscount = p.discounts.reduce((sum, discount) => {
        const startsBeforeMonthEnds = discount.startsAt <= periodEnd;
        const endsAfterMonthStarts =
          discount.endsAt === null || discount.endsAt >= periodStart;

        if (startsBeforeMonthEnds && endsAfterMonthStarts) {
          return sum + discount.amount;
        }

        return sum;
      }, 0);

      expectedDiscount += pavilionDiscount;
      expectedRent += Math.max(baseRent - pavilionDiscount, 0);
      expectedUtilities += p.utilitiesAmount ?? 0;

      for (const pay of p.payments) {
        paidRent += pay.rentPaid ?? 0;
        paidUtilities += pay.utilitiesPaid ?? 0;
      }

      for (const charge of p.additionalCharges) {
        expectedAdditional += charge.amount;
        for (const cp of charge.payments) {
          paidAdditional += cp.amountPaid;
        }
      }
    }

    return {
      pavilions: {
        total: pavilions.length,
        rented: pavilions.filter((p) => p.status === 'RENTED').length,
        free: pavilions.filter((p) => p.status === 'AVAILABLE').length,
      },
      expected: {
        discount: expectedDiscount,
        rent: expectedRent,
        utilities: expectedUtilities,
        additional: expectedAdditional,
        total: expectedRent + expectedUtilities + expectedAdditional,
      },
      paid: {
        rent: paidRent,
        utilities: paidUtilities,
        additional: paidAdditional,
        total: paidRent + paidUtilities + paidAdditional,
      },
      debt:
        expectedRent +
        expectedUtilities +
        expectedAdditional -
        (paidRent + paidUtilities + paidAdditional),
      period,
    };
  }
}

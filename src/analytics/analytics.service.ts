import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getStoreAnalytics(storeId: number) {
    const pavilions = await this.prisma.pavilion.findMany({
      where: { storeId },
      include: {
        payments: true,
        additionalCharges: {
          include: { payments: true },
        },
      },
    });

    let expectedRent = 0;
    let expectedUtilities = 0;
    let expectedAdditional = 0;

    let paidRent = 0;
    let paidUtilities = 0;
    let paidAdditional = 0;

    for (const p of pavilions) {
      expectedRent += p.rentAmount ?? 0;
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
    };
  }
}

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

    const expectedRent = pavilion.squareMeters * pavilion.pricePerSqM;
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

  //Create/Update payment record for a month
  async addPayment(
    pavilionId: number,
    period: Date,
    data: { rentPaid?: number; utilitiesPaid?: number },
  ) {
    const normalizedPeriod = startOfMonth(period);

    const pavilion = await this.prisma.pavilion.findUnique({
      where: { id: pavilionId },
    });

    if (!pavilion) {
      throw new NotFoundException('Pavilion not found');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return this.prisma.payment.upsert({
      where: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        pavilionId_period: { pavilionId, period: normalizedPeriod },
      },
      update: {
        rentPaid: data.rentPaid,
        utilitiesPaid: data.utilitiesPaid,
      },
      create: {
        pavilionId,
        period: normalizedPeriod,
        rentPaid: data.rentPaid,
        utilitiesPaid: data.utilitiesPaid,
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

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { startOfMonth } from 'date-fns';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async getMonthlySummary(pavilionId: number, period: Date) {
    const normalizedPeriod = startOfMonth(period);

    const pavilion = await this.prisma.pavilion.findUnique({
      where: { id: pavilionId },
      include: {
        additionalCharges: true,
        payments: {
          where: { period: normalizedPeriod },
        },
      },
    });

    if (!pavilion) {
      throw new NotFoundException('Pavilion not found');
    }

    const payment = pavilion.payments[0];

    const expectedRent = pavilion.squareMeters * pavilion.pricePerSqM;

    const expectedUtilities = pavilion.utilitiesAmount ?? 0;

    const expectedAdditional = pavilion.additionalCharges.reduce(
      (sum, c) => sum + c.amount,
      0,
    );

    const expectedTotal = expectedRent + expectedUtilities + expectedAdditional;

    const paidRent = payment?.rentPaid ?? 0;
    const paidUtilities = payment?.utilitiesPaid ?? 0;

    const paidAdditional = await this.prisma.additionalChargePayment.aggregate({
      where: {
        additionalCharge: { pavilionId },
        paidAt: {
          gte: normalizedPeriod,
          lt: startOfMonth(
            new Date(
              normalizedPeriod.getFullYear(),
              normalizedPeriod.getMonth() + 1,
            ),
          ),
        },
      },
      _sum: { amountPaid: true },
    });

    const paidTotal =
      paidRent + paidUtilities + (paidAdditional._sum.amountPaid ?? 0);

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
        additional: paidAdditional._sum.amountPaid ?? 0,
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

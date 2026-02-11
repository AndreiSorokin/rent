import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { endOfMonth, startOfMonth } from 'date-fns';
import { PavilionStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getStoreAnalytics(storeId: number) {
    await this.prisma.pavilion.updateMany({
      where: {
        storeId,
        status: PavilionStatus.PREPAID,
        prepaidUntil: {
          lt: startOfMonth(new Date()),
        },
      },
      data: {
        status: PavilionStatus.RENTED,
        prepaidUntil: null,
      },
    });

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

    const incomePavilions = pavilions.filter(
      (p) => p.status === PavilionStatus.RENTED || p.status === PavilionStatus.PREPAID,
    );

    let forecastRent = 0;
    let forecastUtilities = 0;
    let forecastAdditional = 0;

    let actualRent = 0;
    let actualUtilities = 0;
    let actualAdditional = 0;

    for (const p of incomePavilions) {
      forecastRent += p.squareMeters * p.pricePerSqM;
      forecastUtilities += p.utilitiesAmount ?? 0;
      forecastAdditional += p.additionalCharges.reduce(
        (sum, charge) => sum + charge.amount,
        0,
      );

      for (const pay of p.payments) {
        actualRent += pay.rentPaid ?? 0;
        actualUtilities += pay.utilitiesPaid ?? 0;
      }

      for (const charge of p.additionalCharges) {
        actualAdditional += charge.payments.reduce(
          (sum, cp) => sum + cp.amountPaid,
          0,
        );
      }
    }

    const forecastTotal = forecastRent + forecastUtilities + forecastAdditional;
    const actualTotal = actualRent + actualUtilities + actualAdditional;

    let incomeForecastRent = 0;
    let incomeForecastUtilities = 0;
    let incomeForecastAdditional = 0;

    let incomeActualRent = 0;
    let incomeActualUtilities = 0;
    let incomeActualAdditional = 0;

    for (const p of pavilions) {
      incomeForecastRent += p.squareMeters * p.pricePerSqM;
      incomeForecastUtilities += p.utilitiesAmount ?? 0;
      incomeForecastAdditional += p.additionalCharges.reduce(
        (sum, charge) => sum + charge.amount,
        0,
      );

      for (const pay of p.payments) {
        incomeActualRent += pay.rentPaid ?? 0;
        incomeActualUtilities += pay.utilitiesPaid ?? 0;
      }

      for (const charge of p.additionalCharges) {
        incomeActualAdditional += charge.payments.reduce(
          (sum, cp) => sum + cp.amountPaid,
          0,
        );
      }
    }

    const incomeForecastTotal =
      incomeForecastRent + incomeForecastUtilities + incomeForecastAdditional;
    const incomeActualTotal =
      incomeActualRent + incomeActualUtilities + incomeActualAdditional;

    return {
      pavilions: {
        total: pavilions.length,
        rented: pavilions.filter((p) => p.status === 'RENTED').length,
        free: pavilions.filter((p) => p.status === 'AVAILABLE').length,
        prepaid: pavilions.filter((p) => p.status === 'PREPAID').length,
      },
      forecastIncome: {
        rent: forecastRent,
        utilities: forecastUtilities,
        additional: forecastAdditional,
        total: forecastTotal,
      },
      actualIncome: {
        rent: actualRent,
        utilities: actualUtilities,
        additional: actualAdditional,
        total: actualTotal,
      },
      expected: {
        rent: forecastRent,
        utilities: forecastUtilities,
        additional: forecastAdditional,
        total: forecastTotal,
      },
      paid: {
        rent: actualRent,
        utilities: actualUtilities,
        additional: actualAdditional,
        total: actualTotal,
      },
      debt: forecastTotal - actualTotal,
      income: {
        forecast: {
          rent: incomeForecastRent,
          utilities: incomeForecastUtilities,
          additional: incomeForecastAdditional,
          total: incomeForecastTotal,
        },
        actual: {
          rent: incomeActualRent,
          utilities: incomeActualUtilities,
          additional: incomeActualAdditional,
          total: incomeActualTotal,
        },
      },
      period,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
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
    const prevPeriod = startOfMonth(subMonths(period, 1));
    const prevPeriodStart = startOfMonth(prevPeriod);
    const prevPeriodEnd = endOfMonth(prevPeriod);

    const pavilions = await this.prisma.pavilion.findMany({
      where: { storeId },
      include: {
        payments: {
          where: { period },
        },
        discounts: true,
        householdExpenses: {
          where: {
            createdAt: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
        },
        pavilionExpenses: {
          where: {
            createdAt: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
        },
        additionalCharges: {
          where: {
            createdAt: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
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

    const previousMonthPavilions = await this.prisma.pavilion.findMany({
      where: { storeId },
      include: {
        payments: {
          where: { period: prevPeriod },
        },
        householdExpenses: {
          where: {
            createdAt: {
              gte: prevPeriodStart,
              lte: prevPeriodEnd,
            },
          },
        },
        pavilionExpenses: {
          where: {
            createdAt: {
              gte: prevPeriodStart,
              lte: prevPeriodEnd,
            },
          },
        },
        additionalCharges: {
          where: {
            createdAt: {
              gte: prevPeriodStart,
              lte: prevPeriodEnd,
            },
          },
          include: {
            payments: {
              where: {
                paidAt: {
                  gte: prevPeriodStart,
                  lte: prevPeriodEnd,
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

    for (const p of incomePavilions) {
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

    let expensesTotalForecast = 0;
    let expensesTotalActual = 0;

    const expenseByTypeForecast: Record<string, number> = {
      SALARIES: 0,
      PAYROLL_TAX: 0,
      PROFIT_TAX: 0,
      DIVIDENDS: 0,
      BANK_SERVICES: 0,
      VAT: 0,
      LAND_RENT: 0,
      OTHER: 0,
    };
    const expenseByTypeActual: Record<string, number> = {
      SALARIES: 0,
      PAYROLL_TAX: 0,
      PROFIT_TAX: 0,
      DIVIDENDS: 0,
      BANK_SERVICES: 0,
      VAT: 0,
      LAND_RENT: 0,
      OTHER: 0,
    };
    let expenseUtilitiesForecast = 0;
    let expenseUtilitiesActual = 0;
    let expenseHouseholdTotal = 0;

    let channelsBankTransfer = 0;
    let channelsCashbox1 = 0;
    let channelsCashbox2 = 0;

    for (const pavilion of pavilions) {
      const manualExpensesForecast = pavilion.pavilionExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0,
      );
      const manualExpensesActual = pavilion.pavilionExpenses
        .filter((expense) => expense.status === 'PAID')
        .reduce(
          (sum, expense) => sum + expense.amount,
          0,
        );
      const householdExpensesTotal = pavilion.householdExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0,
      );
      const utilitiesForecast =
        pavilion.status === PavilionStatus.RENTED ||
        pavilion.status === PavilionStatus.PREPAID
          ? (pavilion.utilitiesAmount ?? 0)
          : 0;
      const utilitiesActual = pavilion.payments.reduce(
        (sum, payment) => sum + (payment.utilitiesPaid ?? 0),
        0,
      );

      for (const expense of pavilion.pavilionExpenses) {
        expenseByTypeForecast[expense.type] =
          (expenseByTypeForecast[expense.type] ?? 0) + expense.amount;

        if (expense.status === 'PAID') {
          expenseByTypeActual[expense.type] =
            (expenseByTypeActual[expense.type] ?? 0) + expense.amount;
        }
      }

      expenseUtilitiesForecast += utilitiesForecast;
      expenseUtilitiesActual += utilitiesActual;
      expenseHouseholdTotal += householdExpensesTotal;

      expensesTotalForecast +=
        manualExpensesForecast + householdExpensesTotal + utilitiesForecast;
      expensesTotalActual +=
        manualExpensesActual + householdExpensesTotal + utilitiesActual;
    }

    for (const pavilion of incomePavilions) {
      for (const pay of pavilion.payments) {
        channelsBankTransfer += pay.bankTransferPaid ?? 0;
        channelsCashbox1 += pay.cashbox1Paid ?? 0;
        channelsCashbox2 += pay.cashbox2Paid ?? 0;
      }
    }

    const areaTotal = pavilions.reduce((sum, p) => sum + p.squareMeters, 0);
    const areaRented = pavilions
      .filter((p) => p.status === PavilionStatus.RENTED || p.status === PavilionStatus.PREPAID)
      .reduce((sum, p) => sum + p.squareMeters, 0);
    const areaAvailable = pavilions
      .filter((p) => p.status === PavilionStatus.AVAILABLE)
      .reduce((sum, p) => sum + p.squareMeters, 0);

    const overallIncomeTotal = actualTotal;
    const overallExpenseTotal = expensesTotalForecast;
    const saldo = overallIncomeTotal - overallExpenseTotal;

    const previousIncomePavilions = previousMonthPavilions.filter(
      (p) => p.status === PavilionStatus.RENTED || p.status === PavilionStatus.PREPAID,
    );

    let previousIncomeTotal = 0;
    for (const p of previousIncomePavilions) {
      for (const pay of p.payments) {
        previousIncomeTotal += (pay.rentPaid ?? 0) + (pay.utilitiesPaid ?? 0);
      }
      for (const charge of p.additionalCharges) {
        previousIncomeTotal += charge.payments.reduce(
          (sum, cp) => sum + cp.amountPaid,
          0,
        );
      }
    }

    let previousExpenseTotal = 0;
    for (const pavilion of previousMonthPavilions) {
      const manualExpensesForecast = pavilion.pavilionExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0,
      );
      const householdExpensesTotal = pavilion.householdExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0,
      );
      const utilitiesForecast =
        pavilion.status === PavilionStatus.RENTED ||
        pavilion.status === PavilionStatus.PREPAID
          ? (pavilion.utilitiesAmount ?? 0)
          : 0;

      previousExpenseTotal +=
        manualExpensesForecast + householdExpensesTotal + utilitiesForecast;
    }

    const previousMonthBalance = previousIncomeTotal - previousExpenseTotal;

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
      expenses: {
        total: {
          forecast: expensesTotalForecast,
          actual: expensesTotalActual,
        },
      },
      summaryPage: {
        income: {
          rent: actualRent,
          facilities: actualUtilities,
          additional: actualAdditional,
          total: overallIncomeTotal,
          previousMonthBalance,
          channels: {
            bankTransfer: channelsBankTransfer,
            cashbox1: channelsCashbox1,
            cashbox2: channelsCashbox2,
            total: channelsBankTransfer + channelsCashbox1 + channelsCashbox2,
          },
        },
        expenses: {
          byType: {
            salaries: expenseByTypeForecast.SALARIES ?? 0,
            payrollTax: expenseByTypeForecast.PAYROLL_TAX ?? 0,
            profitTax: expenseByTypeForecast.PROFIT_TAX ?? 0,
            dividends: expenseByTypeForecast.DIVIDENDS ?? 0,
            bankServices: expenseByTypeForecast.BANK_SERVICES ?? 0,
            vat: expenseByTypeForecast.VAT ?? 0,
            landRent: expenseByTypeForecast.LAND_RENT ?? 0,
            other: expenseByTypeForecast.OTHER ?? 0,
            facilities: expenseUtilitiesForecast,
            household: expenseHouseholdTotal,
          },
          totals: {
            forecast: expensesTotalForecast,
            actual: expensesTotalActual,
          },
        },
        saldo,
        tradeArea: {
          pavilionsTotal: pavilions.length,
          pavilionsRented: pavilions.filter((p) => p.status === PavilionStatus.RENTED).length,
          pavilionsAvailable: pavilions.filter((p) => p.status === PavilionStatus.AVAILABLE).length,
          squareTotal: areaTotal,
          squareRented: areaRented,
          squareAvailable: areaAvailable,
        },
      },
      period,
    };
  }
}

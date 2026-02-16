import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import { PavilionStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getStoreAnalytics(storeId: number) {
    const storeMeta = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        utilitiesExpenseStatus: true,
        householdExpenseStatus: true,
        staff: {
          select: {
            salary: true,
            salaryStatus: true,
          },
        },
      },
    });

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
        monthlyLedgers: {
          where: { period },
          take: 1,
        },
        discounts: true,
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

    const previousStoreMeta = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        utilitiesExpenseStatus: true,
        householdExpenseStatus: true,
        staff: {
          select: {
            salary: true,
            salaryStatus: true,
          },
        },
      },
    });
    const [manualExpenses, householdExpenses, previousManualExpenses, previousHouseholdExpenses] =
      await Promise.all([
        this.prisma.pavilionExpense.findMany({
          where: {
            createdAt: {
              gte: periodStart,
              lte: periodEnd,
            },
            OR: [{ storeId }, { pavilion: { storeId } }],
          },
        }),
        this.prisma.householdExpense.findMany({
          where: {
            createdAt: {
              gte: periodStart,
              lte: periodEnd,
            },
            OR: [{ storeId }, { pavilion: { storeId } }],
          },
        }),
        this.prisma.pavilionExpense.findMany({
          where: {
            createdAt: {
              gte: prevPeriodStart,
              lte: prevPeriodEnd,
            },
            OR: [{ storeId }, { pavilion: { storeId } }],
          },
        }),
        this.prisma.householdExpense.findMany({
          where: {
            createdAt: {
              gte: prevPeriodStart,
              lte: prevPeriodEnd,
            },
            OR: [{ storeId }, { pavilion: { storeId } }],
          },
        }),
      ]);

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
      const currentLedger = p.monthlyLedgers[0];
      if (currentLedger) {
        forecastRent += Number(currentLedger.expectedRent ?? 0);
        forecastUtilities += Number(currentLedger.expectedUtilities ?? 0);
        forecastAdditional += Number(currentLedger.expectedAdditional ?? 0);
      } else {
        const baseRent = p.squareMeters * p.pricePerSqM;
        const monthlyDiscount =
          p.status === PavilionStatus.PREPAID
            ? 0
            : this.getMonthlyDiscountTotal(p.discounts, p.squareMeters, period);
        forecastRent +=
          p.status === PavilionStatus.PREPAID
            ? baseRent
            : Math.max(baseRent - monthlyDiscount, 0);
        forecastUtilities += p.utilitiesAmount ?? 0;
        forecastAdditional += p.additionalCharges.reduce(
          (sum, charge) => sum + charge.amount,
          0,
        );
      }

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
      const currentLedger = p.monthlyLedgers[0];
      if (currentLedger) {
        incomeForecastRent += Number(currentLedger.expectedRent ?? 0);
        incomeForecastUtilities += Number(currentLedger.expectedUtilities ?? 0);
        incomeForecastAdditional += Number(currentLedger.expectedAdditional ?? 0);
      } else {
        const baseRent = p.squareMeters * p.pricePerSqM;
        const monthlyDiscount =
          p.status === PavilionStatus.PREPAID
            ? 0
            : this.getMonthlyDiscountTotal(p.discounts, p.squareMeters, period);
        incomeForecastRent +=
          p.status === PavilionStatus.PREPAID
            ? baseRent
            : Math.max(baseRent - monthlyDiscount, 0);
        incomeForecastUtilities += p.utilitiesAmount ?? 0;
        incomeForecastAdditional += p.additionalCharges.reduce(
          (sum, charge) => sum + charge.amount,
          0,
        );
      }

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
    let expenseHouseholdTotal = 0;

    let channelsBankTransfer = 0;
    let channelsCashbox1 = 0;
    let channelsCashbox2 = 0;

    const nonSalaryManualExpenses = manualExpenses.filter(
      (expense) => expense.type !== 'SALARIES',
    );
    const nonSalaryPreviousManualExpenses = previousManualExpenses.filter(
      (expense) => expense.type !== 'SALARIES',
    );
    const staffSalariesForecast = (storeMeta?.staff ?? []).reduce(
      (sum, member) => sum + Number(member.salary ?? 0),
      0,
    );
    const staffSalariesActual = (storeMeta?.staff ?? [])
      .filter((member) => member.salaryStatus === 'PAID')
      .reduce((sum, member) => sum + Number(member.salary ?? 0), 0);

    const manualExpensesForecast = nonSalaryManualExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );
    const manualExpensesActual = nonSalaryManualExpenses
      .filter((expense) => expense.status === 'PAID')
      .reduce((sum, expense) => sum + expense.amount, 0);
    expenseHouseholdTotal = householdExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );

    for (const expense of nonSalaryManualExpenses) {
      expenseByTypeForecast[expense.type] =
        (expenseByTypeForecast[expense.type] ?? 0) + expense.amount;
      if (expense.status === 'PAID') {
        expenseByTypeActual[expense.type] =
          (expenseByTypeActual[expense.type] ?? 0) + expense.amount;
      }
    }
    expenseByTypeForecast.SALARIES = staffSalariesForecast;
    expenseByTypeActual.SALARIES = staffSalariesActual;

    for (const pavilion of pavilions) {
      const utilitiesForecast = pavilion.monthlyLedgers[0]
        ? Number(pavilion.monthlyLedgers[0].expectedUtilities ?? 0)
        : pavilion.status === PavilionStatus.RENTED ||
            pavilion.status === PavilionStatus.PREPAID
          ? (pavilion.utilitiesAmount ?? 0)
          : 0;
      expenseUtilitiesForecast += utilitiesForecast;
    }

    const householdActual =
      storeMeta?.householdExpenseStatus === 'PAID' ? expenseHouseholdTotal : 0;
    const utilitiesActualByStatus =
      storeMeta?.utilitiesExpenseStatus === 'PAID' ? expenseUtilitiesForecast : 0;

    expensesTotalForecast =
      manualExpensesForecast +
      staffSalariesForecast +
      expenseHouseholdTotal +
      expenseUtilitiesForecast;
    expensesTotalActual =
      manualExpensesActual +
      staffSalariesActual +
      householdActual +
      utilitiesActualByStatus;

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
    const overallExpenseTotal = expensesTotalActual;
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

    const previousManualExpensesActual = nonSalaryPreviousManualExpenses
      .filter((expense) => expense.status === 'PAID')
      .reduce((sum, expense) => sum + expense.amount, 0);
    const previousHouseholdExpensesTotal = previousHouseholdExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );
    const previousSalariesActual = (previousStoreMeta?.staff ?? [])
      .filter((member) => member.salaryStatus === 'PAID')
      .reduce((sum, member) => sum + Number(member.salary ?? 0), 0);
    const previousHouseholdActual =
      previousStoreMeta?.householdExpenseStatus === 'PAID'
        ? previousHouseholdExpensesTotal
        : 0;
    const previousUtilitiesActualByStatus =
      previousStoreMeta?.utilitiesExpenseStatus === 'PAID'
        ? previousMonthPavilions.reduce((sum, pavilion) => {
            const utilitiesForecast =
              pavilion.status === PavilionStatus.RENTED ||
              pavilion.status === PavilionStatus.PREPAID
                ? (pavilion.utilitiesAmount ?? 0)
                : 0;
            return sum + utilitiesForecast;
          }, 0)
        : 0;
    const previousExpenseTotal =
      previousManualExpensesActual +
      previousSalariesActual +
      previousHouseholdActual +
      previousUtilitiesActualByStatus;

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
            salaries: expenseByTypeActual.SALARIES ?? 0,
            payrollTax: expenseByTypeActual.PAYROLL_TAX ?? 0,
            profitTax: expenseByTypeActual.PROFIT_TAX ?? 0,
            dividends: expenseByTypeActual.DIVIDENDS ?? 0,
            bankServices: expenseByTypeActual.BANK_SERVICES ?? 0,
            vat: expenseByTypeActual.VAT ?? 0,
            landRent: expenseByTypeActual.LAND_RENT ?? 0,
            other: expenseByTypeActual.OTHER ?? 0,
            facilities: utilitiesActualByStatus,
            household: householdActual,
          },
          byTypeForecast: {
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
          storeLevel: {
            manual: {
              forecast: manualExpensesForecast,
              actual: manualExpensesActual,
            },
            salaries: {
              forecast: staffSalariesForecast,
              actual: staffSalariesActual,
            },
            household: {
              forecast: expenseHouseholdTotal,
              actual: householdActual,
              status: storeMeta?.householdExpenseStatus ?? 'UNPAID',
            },
            utilities: {
              forecast: expenseUtilitiesForecast,
              actual: utilitiesActualByStatus,
              status: storeMeta?.utilitiesExpenseStatus ?? 'UNPAID',
            },
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
}

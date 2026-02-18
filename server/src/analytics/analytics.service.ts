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
    const [
      manualExpenses,
      householdExpenses,
      previousManualExpenses,
      previousHouseholdExpenses,
    ] =
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
    let forecastAdvertising = 0;
    let forecastAdditional = 0;

    let actualRent = 0;
    let actualUtilities = 0;
    let actualAdvertising = 0;
    let actualAdditional = 0;

    for (const p of incomePavilions) {
      const currentLedger = p.monthlyLedgers[0];
      if (currentLedger) {
        forecastRent += Number(currentLedger.expectedRent ?? 0);
        forecastUtilities += Number(currentLedger.expectedUtilities ?? 0);
        forecastAdvertising += Number(currentLedger.expectedAdvertising ?? 0);
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
        forecastAdvertising += p.status === PavilionStatus.RENTED ? (p.advertisingAmount ?? 0) : 0;
        forecastAdditional += p.additionalCharges.reduce(
          (sum, charge) => sum + charge.amount,
          0,
        );
      }

      for (const pay of p.payments) {
        actualRent += pay.rentPaid ?? 0;
        actualUtilities += pay.utilitiesPaid ?? 0;
        actualAdvertising += pay.advertisingPaid ?? 0;
      }

      for (const charge of p.additionalCharges) {
        actualAdditional += charge.payments.reduce(
          (sum, cp) => sum + cp.amountPaid,
          0,
        );
      }
    }

    const forecastTotal =
      forecastRent + forecastUtilities + forecastAdvertising + forecastAdditional;
    const actualTotal = actualRent + actualUtilities + actualAdvertising + actualAdditional;

    let incomeForecastRent = 0;
    let incomeForecastUtilities = 0;
    let incomeForecastAdvertising = 0;
    let incomeForecastAdditional = 0;

    let incomeActualRent = 0;
    let incomeActualUtilities = 0;
    let incomeActualAdvertising = 0;
    let incomeActualAdditional = 0;

    for (const p of incomePavilions) {
      const currentLedger = p.monthlyLedgers[0];
      if (currentLedger) {
        incomeForecastRent += Number(currentLedger.expectedRent ?? 0);
        incomeForecastUtilities += Number(currentLedger.expectedUtilities ?? 0);
        incomeForecastAdvertising += Number(currentLedger.expectedAdvertising ?? 0);
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
        incomeForecastAdvertising += p.status === PavilionStatus.RENTED ? (p.advertisingAmount ?? 0) : 0;
        incomeForecastAdditional += p.additionalCharges.reduce(
          (sum, charge) => sum + charge.amount,
          0,
        );
      }

      for (const pay of p.payments) {
        incomeActualRent += pay.rentPaid ?? 0;
        incomeActualUtilities += pay.utilitiesPaid ?? 0;
        incomeActualAdvertising += pay.advertisingPaid ?? 0;
      }

      for (const charge of p.additionalCharges) {
        incomeActualAdditional += charge.payments.reduce(
          (sum, cp) => sum + cp.amountPaid,
          0,
        );
      }
    }

    const incomeForecastTotal =
      incomeForecastRent +
      incomeForecastUtilities +
      incomeForecastAdvertising +
      incomeForecastAdditional;
    const incomeActualTotal =
      incomeActualRent +
      incomeActualUtilities +
      incomeActualAdvertising +
      incomeActualAdditional;

    let expensesTotalForecast = 0;
    let expensesTotalActual = 0;

    const expenseByTypeForecast: Record<string, number> = {
      SALARIES: 0,
      STORE_FACILITIES: 0,
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
      STORE_FACILITIES: 0,
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
    let rentChannelsBankTransfer = 0;
    let rentChannelsCashbox1 = 0;
    let rentChannelsCashbox2 = 0;
    let facilitiesChannelsBankTransfer = 0;
    let facilitiesChannelsCashbox1 = 0;
    let facilitiesChannelsCashbox2 = 0;
    let advertisingChannelsBankTransfer = 0;
    let advertisingChannelsCashbox1 = 0;
    let advertisingChannelsCashbox2 = 0;

    const nonSalaryManualExpenses = manualExpenses.filter(
      (expense) => expense.type !== 'SALARIES',
    );
    const nonSalaryPreviousManualExpenses = previousManualExpenses.filter(
      (expense) => expense.type !== 'SALARIES',
    );
    const storeFacilitiesExpenses = nonSalaryManualExpenses.filter(
      (expense) => String(expense.type) === 'STORE_FACILITIES',
    );
    const previousStoreFacilitiesExpenses = nonSalaryPreviousManualExpenses.filter(
      (expense) => String(expense.type) === 'STORE_FACILITIES',
    );
    const manualAdministrativeExpenses = nonSalaryManualExpenses.filter(
      (expense) => String(expense.type) !== 'STORE_FACILITIES',
    );
    const previousManualAdministrativeExpenses = nonSalaryPreviousManualExpenses.filter(
      (expense) => String(expense.type) !== 'STORE_FACILITIES',
    );
    const staffSalariesForecast = (storeMeta?.staff ?? []).reduce(
      (sum, member) => sum + Number(member.salary ?? 0),
      0,
    );
    const staffSalariesActual = (storeMeta?.staff ?? [])
      .filter((member) => member.salaryStatus === 'PAID')
      .reduce((sum, member) => sum + Number(member.salary ?? 0), 0);

    const manualExpensesForecast = manualAdministrativeExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );
    const manualExpensesActual = manualAdministrativeExpenses
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

    expenseUtilitiesForecast = storeFacilitiesExpenses.reduce(
      (sum, expense) => sum + Number(expense.amount ?? 0),
      0,
    );

    const householdActual =
      storeMeta?.householdExpenseStatus === 'PAID' ? expenseHouseholdTotal : 0;
    const utilitiesActualByStatus = storeFacilitiesExpenses
      .filter((expense) => expense.status === 'PAID')
      .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
    const facilitiesStatus =
      expenseUtilitiesForecast > 0 &&
      Math.abs(utilitiesActualByStatus - expenseUtilitiesForecast) < 0.01
        ? 'PAID'
        : 'UNPAID';

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
        const rentBank = pay.rentBankTransferPaid ?? 0;
        const rentCash1 = pay.rentCashbox1Paid ?? 0;
        const rentCash2 = pay.rentCashbox2Paid ?? 0;
        const utilBank = pay.utilitiesBankTransferPaid ?? 0;
        const utilCash1 = pay.utilitiesCashbox1Paid ?? 0;
        const utilCash2 = pay.utilitiesCashbox2Paid ?? 0;
        const advBank = pay.advertisingBankTransferPaid ?? 0;
        const advCash1 = pay.advertisingCashbox1Paid ?? 0;
        const advCash2 = pay.advertisingCashbox2Paid ?? 0;
        const hasEntityChannels =
          rentBank > 0 ||
          rentCash1 > 0 ||
          rentCash2 > 0 ||
          utilBank > 0 ||
          utilCash1 > 0 ||
          utilCash2 > 0 ||
          advBank > 0 ||
          advCash1 > 0 ||
          advCash2 > 0;

        if (hasEntityChannels) {
          rentChannelsBankTransfer += rentBank;
          rentChannelsCashbox1 += rentCash1;
          rentChannelsCashbox2 += rentCash2;
          facilitiesChannelsBankTransfer += utilBank;
          facilitiesChannelsCashbox1 += utilCash1;
          facilitiesChannelsCashbox2 += utilCash2;
          advertisingChannelsBankTransfer += advBank;
          advertisingChannelsCashbox1 += advCash1;
          advertisingChannelsCashbox2 += advCash2;
        } else {
          // Backward compatibility for old records where channels were stored only for rent.
          rentChannelsBankTransfer += pay.bankTransferPaid ?? 0;
          rentChannelsCashbox1 += pay.cashbox1Paid ?? 0;
          rentChannelsCashbox2 += pay.cashbox2Paid ?? 0;
        }
      }

      for (const charge of pavilion.additionalCharges) {
        for (const payment of charge.payments) {
          advertisingChannelsBankTransfer += payment.bankTransferPaid ?? 0;
          advertisingChannelsCashbox1 += payment.cashbox1Paid ?? 0;
          advertisingChannelsCashbox2 += payment.cashbox2Paid ?? 0;
        }
      }
    }
    channelsBankTransfer =
      rentChannelsBankTransfer +
      facilitiesChannelsBankTransfer +
      advertisingChannelsBankTransfer;
    channelsCashbox1 =
      rentChannelsCashbox1 + facilitiesChannelsCashbox1 + advertisingChannelsCashbox1;
    channelsCashbox2 =
      rentChannelsCashbox2 + facilitiesChannelsCashbox2 + advertisingChannelsCashbox2;

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
        previousIncomeTotal +=
          (pay.rentPaid ?? 0) + (pay.utilitiesPaid ?? 0) + (pay.advertisingPaid ?? 0);
      }
      for (const charge of p.additionalCharges) {
        previousIncomeTotal += charge.payments.reduce(
          (sum, cp) => sum + cp.amountPaid,
          0,
        );
      }
    }

    const previousManualExpensesActual = previousManualAdministrativeExpenses
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
    const previousUtilitiesActualByStatus = previousStoreFacilitiesExpenses
      .filter((expense) => expense.status === 'PAID')
      .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
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
        advertising: forecastAdvertising,
        additional: forecastAdditional,
        total: forecastTotal,
      },
      actualIncome: {
        rent: actualRent,
        utilities: actualUtilities,
        advertising: actualAdvertising,
        additional: actualAdditional,
        total: actualTotal,
      },
      expected: {
        rent: forecastRent,
        utilities: forecastUtilities,
        advertising: forecastAdvertising,
        additional: forecastAdditional,
        total: forecastTotal,
      },
      paid: {
        rent: actualRent,
        utilities: actualUtilities,
        advertising: actualAdvertising,
        additional: actualAdditional,
        total: actualTotal,
      },
      debt: forecastTotal - actualTotal,
      income: {
        forecast: {
          rent: incomeForecastRent,
          utilities: incomeForecastUtilities,
          advertising: incomeForecastAdvertising,
          additional: incomeForecastAdditional,
          total: incomeForecastTotal,
        },
        actual: {
          rent: incomeActualRent,
          utilities: incomeActualUtilities,
          advertising: incomeActualAdvertising,
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
          advertising: actualAdvertising,
          additional: actualAdditional,
          total: overallIncomeTotal,
          previousMonthBalance,
          channels: {
            bankTransfer: channelsBankTransfer,
            cashbox1: channelsCashbox1,
            cashbox2: channelsCashbox2,
            total: channelsBankTransfer + channelsCashbox1 + channelsCashbox2,
          },
          channelsByEntity: {
            rent: {
              bankTransfer: rentChannelsBankTransfer,
              cashbox1: rentChannelsCashbox1,
              cashbox2: rentChannelsCashbox2,
              total:
                rentChannelsBankTransfer + rentChannelsCashbox1 + rentChannelsCashbox2,
            },
            facilities: {
              bankTransfer: facilitiesChannelsBankTransfer,
              cashbox1: facilitiesChannelsCashbox1,
              cashbox2: facilitiesChannelsCashbox2,
              total:
                facilitiesChannelsBankTransfer +
                facilitiesChannelsCashbox1 +
                facilitiesChannelsCashbox2,
            },
            advertising: {
              bankTransfer: advertisingChannelsBankTransfer,
              cashbox1: advertisingChannelsCashbox1,
              cashbox2: advertisingChannelsCashbox2,
              total:
                advertisingChannelsBankTransfer +
                advertisingChannelsCashbox1 +
                advertisingChannelsCashbox2,
            },
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
              status: facilitiesStatus,
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

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import { PavilionStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private normalizeStoreTimeZone(timeZone?: string | null): string {
    const fallback = 'UTC';
    const aliases: Record<string, string> = {
      'Asia/Astana': 'Asia/Almaty',
      'Asia/Nur-Sultan': 'Asia/Almaty',
    };
    const raw = String(timeZone ?? '').trim();
    const normalizedCandidate = aliases[raw] ?? raw;
    if (!normalizedCandidate) return fallback;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: normalizedCandidate }).format(new Date());
      return normalizedCandidate;
    } catch {
      return fallback;
    }
  }

  private getCurrentMonthPeriodInTimeZone(timeZone: string, value = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(value);
    const map = new Map(parts.map((part) => [part.type, part.value]));
    return startOfMonth(
      new Date(Number(map.get('year')), Number(map.get('month')) - 1, 1),
    );
  }

  private getTimeZoneOffsetMs(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    timeZone: string,
  ) {
    const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, 0);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(new Date(utcGuess));
    const map = new Map(parts.map((part) => [part.type, part.value]));
    const localYear = Number(map.get('year'));
    const localMonth = Number(map.get('month'));
    const localDay = Number(map.get('day'));
    const localHour = Number(map.get('hour')) === 24 ? 0 : Number(map.get('hour'));
    const localMinute = Number(map.get('minute'));
    const localSecond = Number(map.get('second'));
    const zonedAsUtc = Date.UTC(
      localYear,
      localMonth - 1,
      localDay,
      localHour,
      localMinute,
      localSecond,
      0,
    );
    return zonedAsUtc - utcGuess;
  }

  private zonedLocalToUtc(
    year: number,
    month: number,
    day: number,
    timeZone: string,
  ) {
    const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    const offsetMs = this.getTimeZoneOffsetMs(year, month, day, 0, 0, 0, timeZone);
    return new Date(utcGuess - offsetMs);
  }

  private getTimeZoneMonthRange(period: Date, timeZone: string) {
    const year = period.getFullYear();
    const month = period.getMonth() + 1;
    const monthStart = this.zonedLocalToUtc(year, month, 1, timeZone);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthYear = month === 12 ? year + 1 : year;
    const nextMonthStart = this.zonedLocalToUtc(nextMonthYear, nextMonth, 1, timeZone);
    return {
      monthStart,
      monthEnd: new Date(nextMonthStart.getTime() - 1),
    };
  }

  private getDateKeyInTimeZone(value: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const map = new Map(parts.map((part) => [part.type, part.value]));
    return `${map.get('year')}-${map.get('month')}-${map.get('day')}`;
  }

  private async getClosingBalanceSnapshot(storeId: number, period: Date, timeZone: string) {
    const { monthEnd } = this.getTimeZoneMonthRange(period, timeZone);
    const paymentRepo = (this.prisma as any).payment;
    const additionalChargePaymentRepo = (this.prisma as any).additionalChargePayment;
    const storeExtraIncomeRepo = (this.prisma as any).storeExtraIncome;

    const [payments, additionalChargePayments, storeExtraIncome, paidExpenses] = await Promise.all([
      paymentRepo?.findMany
        ? paymentRepo.findMany({
            where: {
              pavilion: { storeId },
              period: { lte: period },
            },
          })
        : Promise.resolve([]),
      additionalChargePaymentRepo?.findMany
        ? additionalChargePaymentRepo.findMany({
            where: {
              paidAt: { lte: monthEnd },
              additionalCharge: {
                pavilion: { storeId },
              },
            },
          })
        : Promise.resolve([]),
      storeExtraIncomeRepo?.findMany
        ? storeExtraIncomeRepo.findMany({
            where: {
              storeId,
              period: { lte: period },
            },
          })
        : Promise.resolve([]),
      this.prisma.pavilionExpense.findMany({
        where: {
          createdAt: { lte: monthEnd },
          status: 'PAID',
          OR: [{ storeId }, { pavilion: { storeId } }],
        },
      }),
    ]);

    let incomeTotal = 0;
    let incomeBankTransfer = 0;
    let incomeCashbox1 = 0;
    let incomeCashbox2 = 0;

    for (const pay of payments as any[]) {
      const rentPaid = Number(pay.rentPaid ?? 0);
      const utilitiesPaid = Number(pay.utilitiesPaid ?? 0);
      const advertisingPaid = Number(pay.advertisingPaid ?? 0);
      incomeTotal += rentPaid + utilitiesPaid + advertisingPaid;

      const rentBank = Number(pay.rentBankTransferPaid ?? 0);
      const rentCash1 = Number(pay.rentCashbox1Paid ?? 0);
      const rentCash2 = Number(pay.rentCashbox2Paid ?? 0);
      const utilBank = Number(pay.utilitiesBankTransferPaid ?? 0);
      const utilCash1 = Number(pay.utilitiesCashbox1Paid ?? 0);
      const utilCash2 = Number(pay.utilitiesCashbox2Paid ?? 0);
      const advBank = Number(pay.advertisingBankTransferPaid ?? 0);
      const advCash1 = Number(pay.advertisingCashbox1Paid ?? 0);
      const advCash2 = Number(pay.advertisingCashbox2Paid ?? 0);

      const entityChannelsTotal =
        rentBank +
        rentCash1 +
        rentCash2 +
        utilBank +
        utilCash1 +
        utilCash2 +
        advBank +
        advCash1 +
        advCash2;

      if (entityChannelsTotal > 0) {
        incomeBankTransfer += rentBank + utilBank + advBank;
        incomeCashbox1 += rentCash1 + utilCash1 + advCash1;
        incomeCashbox2 += rentCash2 + utilCash2 + advCash2;
      } else {
        incomeBankTransfer += Number(pay.bankTransferPaid ?? 0);
        incomeCashbox1 += Number(pay.cashbox1Paid ?? 0);
        incomeCashbox2 += Number(pay.cashbox2Paid ?? 0);
      }
    }

    for (const payment of additionalChargePayments as any[]) {
      incomeTotal += Number(payment.amountPaid ?? 0);
      incomeBankTransfer += Number(payment.bankTransferPaid ?? 0);
      incomeCashbox1 += Number(payment.cashbox1Paid ?? 0);
      incomeCashbox2 += Number(payment.cashbox2Paid ?? 0);
    }

    for (const item of storeExtraIncome as any[]) {
      const amount = Number(item.amount ?? 0);
      incomeTotal += amount;
      const bank = Number(item.bankTransferPaid ?? 0);
      const cash1 = Number(item.cashbox1Paid ?? 0);
      const cash2 = Number(item.cashbox2Paid ?? 0);
      if (bank + cash1 + cash2 > 0) {
        incomeBankTransfer += bank;
        incomeCashbox1 += cash1;
        incomeCashbox2 += cash2;
      } else {
        incomeBankTransfer += amount;
      }
    }

    let expenseTotal = 0;
    let expenseBankTransfer = 0;
    let expenseCashbox1 = 0;
    let expenseCashbox2 = 0;

    for (const expense of paidExpenses as any[]) {
      const amount = Number(expense.amount ?? 0);
      expenseTotal += amount;

      const bank = Number(expense.bankTransferPaid ?? 0);
      const cash1 = Number(expense.cashbox1Paid ?? 0);
      const cash2 = Number(expense.cashbox2Paid ?? 0);
      if (bank + cash1 + cash2 > 0) {
        expenseBankTransfer += bank;
        expenseCashbox1 += cash1;
        expenseCashbox2 += cash2;
      } else if (String(expense.paymentMethod) === 'CASHBOX1') {
        expenseCashbox1 += amount;
      } else if (String(expense.paymentMethod) === 'CASHBOX2') {
        expenseCashbox2 += amount;
      } else {
        expenseBankTransfer += amount;
      }
    }

    return {
      balance: incomeTotal - expenseTotal,
      channels: {
        bankTransfer: incomeBankTransfer - expenseBankTransfer,
        cashbox1: incomeCashbox1 - expenseCashbox1,
        cashbox2: incomeCashbox2 - expenseCashbox2,
        total:
          incomeBankTransfer +
          incomeCashbox1 +
          incomeCashbox2 -
          (expenseBankTransfer + expenseCashbox1 + expenseCashbox2),
      },
    };
  }

  async getStoreName(storeId: number) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { name: true },
    });
    return store?.name ?? `Объект #${storeId}`;
  }

  async getStoreAnalytics(storeId: number, periodInput?: string) {
    const storeMeta = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        timeZone: true,
        utilitiesExpenseStatus: true,
        householdExpenseStatus: true,
        staff: {
          select: {
            salary: true,
            salaryStatus: true,
            salaryPaymentMethod: true,
            salaryBankTransferPaid: true,
            salaryCashbox1Paid: true,
            salaryCashbox2Paid: true,
          },
        },
      },
    });

    const storeTimeZone = this.normalizeStoreTimeZone(storeMeta?.timeZone);
    const currentPeriod = this.getCurrentMonthPeriodInTimeZone(storeTimeZone);

    await this.prisma.pavilion.updateMany({
      where: {
        storeId,
        status: PavilionStatus.PREPAID,
        prepaidUntil: {
          lt: currentPeriod,
        },
      },
      data: {
        status: PavilionStatus.RENTED,
        prepaidUntil: null,
      },
    });

    const period = this.parsePeriod(periodInput, storeTimeZone);
    const periodRange = this.getTimeZoneMonthRange(period, storeTimeZone);
    const prevPeriod = startOfMonth(subMonths(period, 1));
    const prevPeriodRange = this.getTimeZoneMonthRange(prevPeriod, storeTimeZone);
    const trendStart = startOfMonth(subMonths(period, 5));
    const additionalChargesForecastRows = await this.prisma.additionalCharge.findMany({
      where: {
        createdAt: {
          gte: periodRange.monthStart,
          lte: periodRange.monthEnd,
        },
        pavilion: {
          storeId,
        },
      },
      select: {
        pavilionId: true,
        amount: true,
      },
    });
    const additionalForecastByPavilion = additionalChargesForecastRows.reduce(
      (map, row) => {
        const pavilionKey = Number(row.pavilionId);
        map.set(pavilionKey, (map.get(pavilionKey) ?? 0) + Number(row.amount ?? 0));
        return map;
      },
      new Map<number, number>(),
    );

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
              gte: periodRange.monthStart,
              lte: periodRange.monthEnd,
            },
          },
          include: {
            payments: {
              where: {
                paidAt: {
                  gte: periodRange.monthStart,
                  lte: periodRange.monthEnd,
                },
              },
            },
          },
        },
        groupMemberships: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
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
              gte: prevPeriodRange.monthStart,
              lte: prevPeriodRange.monthEnd,
            },
          },
          include: {
            payments: {
              where: {
                paidAt: {
                  gte: prevPeriodRange.monthStart,
                  lte: prevPeriodRange.monthEnd,
                },
              },
            },
          },
        },
      },
    });

    const monthlyLedgers = await this.prisma.pavilionMonthlyLedger.findMany({
      where: {
        pavilion: {
          storeId,
        },
        period: {
          gte: trendStart,
          lte: period,
        },
      },
      select: {
        pavilionId: true,
        period: true,
        expectedTotal: true,
        actualTotal: true,
        pavilion: {
          select: {
            squareMeters: true,
          },
        },
      },
    });
    const trendPavilions =
      (await this.prisma.pavilion.findMany({
      where: { storeId },
      select: {
        id: true,
        status: true,
        squareMeters: true,
        payments: {
          where: {
            period: {
              gte: trendStart,
              lte: period,
            },
          },
          select: {
            period: true,
          },
        },
        leases: {
          select: {
            status: true,
            startsOn: true,
            endsOn: true,
            vacatedOn: true,
            createdAt: true,
          },
        },
      },
      })) ?? [];
    const trendPavilionIds = trendPavilions.map((pavilion) => Number(pavilion.id));
    const pavilionCreateActivities =
      trendPavilionIds.length > 0
        ? await this.prisma.storeActivity.findMany({
            where: {
              storeId,
              action: 'CREATE',
              entityType: 'PAVILION',
              pavilionId: { in: trendPavilionIds },
            },
            select: {
              pavilionId: true,
              createdAt: true,
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          })
        : [];
    const pavilionCreatedAtById = new Map<number, Date>();
    for (const activity of pavilionCreateActivities) {
      const pavilionId = Number(activity.pavilionId ?? 0);
      if (!pavilionId || pavilionCreatedAtById.has(pavilionId)) continue;
      pavilionCreatedAtById.set(pavilionId, activity.createdAt);
    }
    const [
      manualExpenses,
      previousManualExpenses,
    ] =
      await Promise.all([
        this.prisma.pavilionExpense.findMany({
          where: {
            createdAt: {
              gte: periodRange.monthStart,
              lte: periodRange.monthEnd,
            },
            OR: [{ storeId }, { pavilion: { storeId } }],
          },
        }),
        this.prisma.pavilionExpense.findMany({
          where: {
            createdAt: {
              gte: prevPeriodRange.monthStart,
              lte: prevPeriodRange.monthEnd,
            },
            OR: [{ storeId }, { pavilion: { storeId } }],
          },
        }),
      ]);
    const storeExtraIncomeRepo = (this.prisma as any).storeExtraIncome;
    const [storeExtraIncomeCurrent, storeExtraIncomePrevious, storeExtraIncomeTrend] =
      await Promise.all([
        storeExtraIncomeRepo?.findMany
          ? storeExtraIncomeRepo.findMany({
              where: {
                storeId,
                period,
              },
            })
          : Promise.resolve([]),
        storeExtraIncomeRepo?.findMany
          ? storeExtraIncomeRepo.findMany({
              where: {
                storeId,
                period: prevPeriod,
              },
            })
          : Promise.resolve([]),
        storeExtraIncomeRepo?.findMany
          ? storeExtraIncomeRepo.findMany({
              where: {
                storeId,
                period: {
                  gte: trendStart,
                  lte: period,
                },
              },
              select: {
                period: true,
                amount: true,
              },
            })
          : Promise.resolve([]),
      ]);

    const incomePavilions = pavilions.filter(
      (p) => p.status === PavilionStatus.RENTED || p.status === PavilionStatus.PREPAID,
    );

    let forecastRent = 0;
    let forecastUtilities = 0;
    let forecastAdvertising = 0;
    let forecastAdditional = 0;
    let forecastStoreExtra = 0;

    let actualRent = 0;
    let actualUtilities = 0;
    let actualAdvertising = 0;
    let actualAdditional = 0;
    let actualStoreExtra = 0;

    for (const p of incomePavilions) {
      const currentLedger = p.monthlyLedgers[0];
      const currentAdditionalForecast =
        p.status === PavilionStatus.RENTED
          ? Number(additionalForecastByPavilion.get(Number(p.id)) ?? 0)
          : 0;
      if (currentLedger) {
        forecastRent += Number(currentLedger.expectedRent ?? 0);
        forecastUtilities += Number(currentLedger.expectedUtilities ?? 0);
        forecastAdvertising += Number(currentLedger.expectedAdvertising ?? 0);
        forecastAdditional += currentAdditionalForecast;
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
        forecastAdditional += currentAdditionalForecast;
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

    forecastStoreExtra = storeExtraIncomeCurrent.reduce(
      (sum, item) => sum + Number(item.amount ?? 0),
      0,
    );
    const forecastTotal =
      forecastRent +
      forecastUtilities +
      forecastAdvertising +
      forecastAdditional +
      forecastStoreExtra;
    actualStoreExtra = storeExtraIncomeCurrent.reduce(
      (sum, item) => sum + Number(item.amount ?? 0),
      0,
    );
    const actualTotal =
      actualRent +
      actualUtilities +
      actualAdvertising +
      actualAdditional +
      actualStoreExtra;

    let incomeForecastRent = 0;
    let incomeForecastUtilities = 0;
    let incomeForecastAdvertising = 0;
    let incomeForecastAdditional = 0;
    let incomeForecastStoreExtra = 0;

    let incomeActualRent = 0;
    let incomeActualUtilities = 0;
    let incomeActualAdvertising = 0;
    let incomeActualAdditional = 0;
    let incomeActualStoreExtra = 0;

    for (const p of incomePavilions) {
      const currentLedger = p.monthlyLedgers[0];
      const currentAdditionalForecast =
        p.status === PavilionStatus.RENTED
          ? Number(additionalForecastByPavilion.get(Number(p.id)) ?? 0)
          : 0;
      if (currentLedger) {
        incomeForecastRent += Number(currentLedger.expectedRent ?? 0);
        incomeForecastUtilities += Number(currentLedger.expectedUtilities ?? 0);
        incomeForecastAdvertising += Number(currentLedger.expectedAdvertising ?? 0);
        incomeForecastAdditional += currentAdditionalForecast;
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
        incomeForecastAdditional += currentAdditionalForecast;
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

    incomeForecastStoreExtra = forecastStoreExtra;
    const incomeForecastTotal =
      incomeForecastRent +
      incomeForecastUtilities +
      incomeForecastAdvertising +
      incomeForecastAdditional +
      incomeForecastStoreExtra;
    incomeActualStoreExtra = actualStoreExtra;
    const incomeActualTotal =
      incomeActualRent +
      incomeActualUtilities +
      incomeActualAdvertising +
      incomeActualAdditional +
      incomeActualStoreExtra;

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
    const makeChannels = () => ({
      bankTransfer: 0,
      cashbox1: 0,
      cashbox2: 0,
    });
    const expenseChannelsByType: Record<
      string,
      { bankTransfer: number; cashbox1: number; cashbox2: number }
    > = {
      SALARIES: makeChannels(),
      STORE_FACILITIES: makeChannels(),
      HOUSEHOLD: makeChannels(),
      PAYROLL_TAX: makeChannels(),
      PROFIT_TAX: makeChannels(),
      DIVIDENDS: makeChannels(),
      BANK_SERVICES: makeChannels(),
      VAT: makeChannels(),
      LAND_RENT: makeChannels(),
      OTHER: makeChannels(),
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
    let additionalChannelsBankTransfer = 0;
    let additionalChannelsCashbox1 = 0;
    let additionalChannelsCashbox2 = 0;
    let storeExtraChannelsBankTransfer = 0;
    let storeExtraChannelsCashbox1 = 0;
    let storeExtraChannelsCashbox2 = 0;
    let expenseChannelsBankTransfer = 0;
    let expenseChannelsCashbox1 = 0;
    let expenseChannelsCashbox2 = 0;
    let previousIncomeChannelsBankTransfer = 0;
    let previousIncomeChannelsCashbox1 = 0;
    let previousIncomeChannelsCashbox2 = 0;
    let previousExpenseChannelsBankTransfer = 0;
    let previousExpenseChannelsCashbox1 = 0;
    let previousExpenseChannelsCashbox2 = 0;

    const nonSalaryManualExpenses = manualExpenses.filter(
      (expense) => expense.type !== 'SALARIES',
    );
    const nonSalaryPreviousManualExpenses = previousManualExpenses.filter(
      (expense) => expense.type !== 'SALARIES',
    );
    const storeFacilitiesExpenses = nonSalaryManualExpenses.filter(
      (expense) => String(expense.type) === 'STORE_FACILITIES',
    );
    const householdTypeExpenses = nonSalaryManualExpenses.filter(
      (expense) => String(expense.type) === 'HOUSEHOLD',
    );
    const previousStoreFacilitiesExpenses = nonSalaryPreviousManualExpenses.filter(
      (expense) => String(expense.type) === 'STORE_FACILITIES',
    );
    const previousHouseholdTypeExpenses = nonSalaryPreviousManualExpenses.filter(
      (expense) => String(expense.type) === 'HOUSEHOLD',
    );
    const manualAdministrativeExpenses = nonSalaryManualExpenses.filter(
      (expense) =>
        String(expense.type) !== 'STORE_FACILITIES' &&
        String(expense.type) !== 'HOUSEHOLD',
    );
    const previousManualAdministrativeExpenses = nonSalaryPreviousManualExpenses.filter(
      (expense) =>
        String(expense.type) !== 'STORE_FACILITIES' &&
        String(expense.type) !== 'HOUSEHOLD',
    );
    const staffSalariesForecast = (storeMeta?.staff ?? []).reduce(
      (sum, member) => sum + Number(member.salary ?? 0),
      0,
    );
    const salaryExpensesActualCurrent = manualExpenses
      .filter(
        (expense) => expense.type === 'SALARIES' && expense.status === 'PAID',
      )
      .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
    const fallbackStaffSalariesActual = (storeMeta?.staff ?? [])
      .filter((member) => member.salaryStatus === 'PAID')
      .reduce((sum, member) => sum + Number(member.salary ?? 0), 0);
    const staffSalariesActual =
      salaryExpensesActualCurrent > 0
        ? salaryExpensesActualCurrent
        : fallbackStaffSalariesActual;

    const manualExpensesForecast = manualAdministrativeExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );
    const manualExpensesActual = manualAdministrativeExpenses
      .filter((expense) => expense.status === 'PAID')
      .reduce((sum, expense) => sum + expense.amount, 0);
    expenseHouseholdTotal = householdTypeExpenses.reduce(
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

    const householdActual = householdTypeExpenses
      .filter((expense) => expense.status === 'PAID')
      .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
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

    const addExpenseByMethod = (
      amount: number,
      method?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2' | null,
    ) => {
      const safeAmount = Number(amount ?? 0);
      if (safeAmount <= 0) return;
      if (method === 'CASHBOX1') {
        expenseChannelsCashbox1 += safeAmount;
        return;
      }
      if (method === 'CASHBOX2') {
        expenseChannelsCashbox2 += safeAmount;
        return;
      }
      expenseChannelsBankTransfer += safeAmount;
    };
    const addExpenseByChannelsOrMethod = (
      expense: any,
      fallbackAmount: number,
      fallbackMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2' | null,
      expenseType?: string,
    ) => {
      const bank = Number(expense?.bankTransferPaid ?? 0);
      const cash1 = Number(expense?.cashbox1Paid ?? 0);
      const cash2 = Number(expense?.cashbox2Paid ?? 0);
      const channelsTotal = bank + cash1 + cash2;
      if (channelsTotal > 0) {
        expenseChannelsBankTransfer += bank;
        expenseChannelsCashbox1 += cash1;
        expenseChannelsCashbox2 += cash2;
        if (expenseType && expenseChannelsByType[expenseType]) {
          expenseChannelsByType[expenseType].bankTransfer += bank;
          expenseChannelsByType[expenseType].cashbox1 += cash1;
          expenseChannelsByType[expenseType].cashbox2 += cash2;
        }
        return;
      }

      if (expenseType && expenseChannelsByType[expenseType]) {
        const safeAmount = Number(fallbackAmount ?? 0);
        if (safeAmount > 0) {
          if (fallbackMethod === 'CASHBOX1') {
            expenseChannelsByType[expenseType].cashbox1 += safeAmount;
          } else if (fallbackMethod === 'CASHBOX2') {
            expenseChannelsByType[expenseType].cashbox2 += safeAmount;
          } else {
            expenseChannelsByType[expenseType].bankTransfer += safeAmount;
          }
        }
      }
      addExpenseByMethod(fallbackAmount, fallbackMethod);
    };

    for (const expense of nonSalaryManualExpenses) {
      if (expense.status !== 'PAID') continue;
      addExpenseByChannelsOrMethod(
        expense,
        Number(expense.amount ?? 0),
        (expense as any).paymentMethod as
          | 'BANK_TRANSFER'
          | 'CASHBOX1'
          | 'CASHBOX2'
          | null,
        String(expense.type),
      );
    }

    if (salaryExpensesActualCurrent > 0) {
      const paidSalaryEntries = manualExpenses.filter(
        (expense) => expense.type === 'SALARIES' && expense.status === 'PAID',
      );
      for (const expense of paidSalaryEntries) {
        addExpenseByChannelsOrMethod(
          expense,
          Number(expense.amount ?? 0),
          (expense as any).paymentMethod as
            | 'BANK_TRANSFER'
            | 'CASHBOX1'
            | 'CASHBOX2'
            | null,
          'SALARIES',
        );
      }
    } else {
      for (const member of storeMeta?.staff ?? []) {
        if (member.salaryStatus !== 'PAID') continue;
        const bank = Number((member as any).salaryBankTransferPaid ?? 0);
        const cash1 = Number((member as any).salaryCashbox1Paid ?? 0);
        const cash2 = Number((member as any).salaryCashbox2Paid ?? 0);
        const total = bank + cash1 + cash2;
        if (total > 0) {
          expenseChannelsBankTransfer += bank;
          expenseChannelsCashbox1 += cash1;
          expenseChannelsCashbox2 += cash2;
          expenseChannelsByType.SALARIES.bankTransfer += bank;
          expenseChannelsByType.SALARIES.cashbox1 += cash1;
          expenseChannelsByType.SALARIES.cashbox2 += cash2;
        } else {
          const fallbackMethod = (member as any).salaryPaymentMethod as
            | 'BANK_TRANSFER'
            | 'CASHBOX1'
            | 'CASHBOX2'
            | null;
          const salaryAmount = Number(member.salary ?? 0);
          if (fallbackMethod === 'CASHBOX1') {
            expenseChannelsByType.SALARIES.cashbox1 += salaryAmount;
          } else if (fallbackMethod === 'CASHBOX2') {
            expenseChannelsByType.SALARIES.cashbox2 += salaryAmount;
          } else {
            expenseChannelsByType.SALARIES.bankTransfer += salaryAmount;
          }
          addExpenseByMethod(
            salaryAmount,
            fallbackMethod,
          );
        }
      }
    }

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
          additionalChannelsBankTransfer += payment.bankTransferPaid ?? 0;
          additionalChannelsCashbox1 += payment.cashbox1Paid ?? 0;
          additionalChannelsCashbox2 += payment.cashbox2Paid ?? 0;
        }
      }
    }
    for (const incomeItem of storeExtraIncomeCurrent) {
      storeExtraChannelsBankTransfer += Number(incomeItem.bankTransferPaid ?? 0);
      storeExtraChannelsCashbox1 += Number(incomeItem.cashbox1Paid ?? 0);
      storeExtraChannelsCashbox2 += Number(incomeItem.cashbox2Paid ?? 0);
    }
    channelsBankTransfer =
      rentChannelsBankTransfer +
      facilitiesChannelsBankTransfer +
      advertisingChannelsBankTransfer +
      additionalChannelsBankTransfer +
      storeExtraChannelsBankTransfer;
    channelsCashbox1 =
      rentChannelsCashbox1 +
      facilitiesChannelsCashbox1 +
      advertisingChannelsCashbox1 +
      additionalChannelsCashbox1 +
      storeExtraChannelsCashbox1;
    channelsCashbox2 =
      rentChannelsCashbox2 +
      facilitiesChannelsCashbox2 +
      advertisingChannelsCashbox2 +
      additionalChannelsCashbox2 +
      storeExtraChannelsCashbox2;

    const areaTotal = pavilions.reduce((sum, p) => sum + p.squareMeters, 0);
    const areaRented = pavilions
      .filter((p) => p.status === PavilionStatus.RENTED || p.status === PavilionStatus.PREPAID)
      .reduce((sum, p) => sum + p.squareMeters, 0);
    const areaAvailable = pavilions
      .filter((p) => p.status === PavilionStatus.AVAILABLE)
      .reduce((sum, p) => sum + p.squareMeters, 0);

    const groupSummariesMap = new Map<
      number,
      {
        groupId: number;
        name: string;
        pavilionsTotal: number;
        pavilionsRentedOrPrepaid: number;
        squareTotal: number;
        forecastIncome: number;
        actualIncome: number;
      }
    >();

    for (const pavilion of pavilions) {
      const currentLedger = pavilion.monthlyLedgers[0];
      let pavilionForecast = 0;
      if (currentLedger) {
        pavilionForecast += Number(currentLedger.expectedTotal ?? 0);
      } else {
        const baseRent = pavilion.squareMeters * pavilion.pricePerSqM;
        const monthlyDiscount =
          pavilion.status === PavilionStatus.PREPAID
            ? 0
            : this.getMonthlyDiscountTotal(
                pavilion.discounts,
                pavilion.squareMeters,
                period,
              );
        const expectedRent =
          pavilion.status === PavilionStatus.PREPAID
            ? baseRent
            : pavilion.status === PavilionStatus.RENTED
              ? Math.max(baseRent - monthlyDiscount, 0)
              : 0;
        const expectedUtilities =
          pavilion.status === PavilionStatus.RENTED
            ? Number(pavilion.utilitiesAmount ?? 0)
            : 0;
        const expectedAdvertising =
          pavilion.status === PavilionStatus.RENTED
            ? Number(pavilion.advertisingAmount ?? 0)
            : 0;
        const expectedAdditional =
          pavilion.status === PavilionStatus.RENTED
            ? pavilion.additionalCharges.reduce(
                (sum, charge) => sum + Number(charge.amount ?? 0),
                0,
              )
            : 0;
        pavilionForecast =
          expectedRent + expectedUtilities + expectedAdvertising + expectedAdditional;
      }

      const pavilionActualRentUtilitiesAdvertising = pavilion.payments.reduce(
        (sum, pay) =>
          sum +
          Number(pay.rentPaid ?? 0) +
          Number(pay.utilitiesPaid ?? 0) +
          Number(pay.advertisingPaid ?? 0),
        0,
      );
      const pavilionActualAdditional = pavilion.additionalCharges.reduce(
        (sum, charge) =>
          sum +
          charge.payments.reduce(
            (chargeSum, payment) => chargeSum + Number(payment.amountPaid ?? 0),
            0,
          ),
        0,
      );
      const pavilionActual =
        pavilionActualRentUtilitiesAdvertising + pavilionActualAdditional;

      for (const membership of pavilion.groupMemberships) {
        const groupId = membership.group.id;
        if (!groupSummariesMap.has(groupId)) {
          groupSummariesMap.set(groupId, {
            groupId,
            name: membership.group.name,
            pavilionsTotal: 0,
            pavilionsRentedOrPrepaid: 0,
            squareTotal: 0,
            forecastIncome: 0,
            actualIncome: 0,
          });
        }

        const group = groupSummariesMap.get(groupId);
        if (!group) continue;
        group.pavilionsTotal += 1;
        if (
          pavilion.status === PavilionStatus.RENTED ||
          pavilion.status === PavilionStatus.PREPAID
        ) {
          group.pavilionsRentedOrPrepaid += 1;
        }
        group.squareTotal += Number(pavilion.squareMeters ?? 0);
        group.forecastIncome += pavilionForecast;
        group.actualIncome += pavilionActual;
      }
    }

    const groupSummaries = Array.from(groupSummariesMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((group) => ({
        ...group,
        delta: group.actualIncome - group.forecastIncome,
      }));

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
    previousIncomeTotal += storeExtraIncomePrevious.reduce(
      (sum, item) => sum + Number(item.amount ?? 0),
      0,
    );

    const previousManualExpensesActual = previousManualAdministrativeExpenses
      .filter((expense) => expense.status === 'PAID')
      .reduce((sum, expense) => sum + expense.amount, 0);
    const previousHouseholdExpensesTotal = previousHouseholdTypeExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );
    const previousSalariesActual = previousManualExpenses
      .filter(
        (expense) => expense.type === 'SALARIES' && expense.status === 'PAID',
      )
      .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
    const previousHouseholdActual = previousHouseholdTypeExpenses
      .filter((expense) => expense.status === 'PAID')
      .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
    const householdStatus =
      expenseHouseholdTotal > 0 &&
      Math.abs(householdActual - expenseHouseholdTotal) < 0.01
        ? 'PAID'
        : 'UNPAID';
    const previousUtilitiesActualByStatus = previousStoreFacilitiesExpenses
      .filter((expense) => expense.status === 'PAID')
      .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
    const previousExpenseTotal =
      previousManualExpensesActual +
      previousSalariesActual +
      previousHouseholdActual +
      previousUtilitiesActualByStatus;

    const previousClosingSnapshot = await this.getClosingBalanceSnapshot(
      storeId,
      prevPeriod,
      storeTimeZone,
    );
    const previousMonthBalance = previousClosingSnapshot.balance;
    const carryAggregate = await this.prisma.pavilionMonthlyLedger.aggregate({
      where: {
        period: prevPeriod,
        pavilion: {
          storeId,
        },
      },
      _sum: {
        closingDebt: true,
      },
    });
    const carryAdjustment = Number(carryAggregate._sum.closingDebt ?? 0);
    const addPreviousExpenseByMethod = (
      amount: number,
      method?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2' | null,
    ) => {
      const safeAmount = Number(amount ?? 0);
      if (safeAmount <= 0) return;
      if (method === 'CASHBOX1') {
        previousExpenseChannelsCashbox1 += safeAmount;
        return;
      }
      if (method === 'CASHBOX2') {
        previousExpenseChannelsCashbox2 += safeAmount;
        return;
      }
      previousExpenseChannelsBankTransfer += safeAmount;
    };
    const addPreviousExpenseByChannelsOrMethod = (
      expense: any,
      fallbackAmount: number,
      fallbackMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2' | null,
    ) => {
      const bank = Number(expense?.bankTransferPaid ?? 0);
      const cash1 = Number(expense?.cashbox1Paid ?? 0);
      const cash2 = Number(expense?.cashbox2Paid ?? 0);
      const channelsTotal = bank + cash1 + cash2;
      if (channelsTotal > 0) {
        previousExpenseChannelsBankTransfer += bank;
        previousExpenseChannelsCashbox1 += cash1;
        previousExpenseChannelsCashbox2 += cash2;
        return;
      }
      addPreviousExpenseByMethod(fallbackAmount, fallbackMethod);
    };

    for (const pavilion of previousIncomePavilions) {
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
          previousIncomeChannelsBankTransfer += rentBank + utilBank + advBank;
          previousIncomeChannelsCashbox1 += rentCash1 + utilCash1 + advCash1;
          previousIncomeChannelsCashbox2 += rentCash2 + utilCash2 + advCash2;
        } else {
          // Backward compatibility for old records where channels were stored only for rent.
          previousIncomeChannelsBankTransfer += pay.bankTransferPaid ?? 0;
          previousIncomeChannelsCashbox1 += pay.cashbox1Paid ?? 0;
          previousIncomeChannelsCashbox2 += pay.cashbox2Paid ?? 0;
        }
      }

      for (const charge of pavilion.additionalCharges) {
        for (const payment of charge.payments) {
          previousIncomeChannelsBankTransfer += payment.bankTransferPaid ?? 0;
          previousIncomeChannelsCashbox1 += payment.cashbox1Paid ?? 0;
          previousIncomeChannelsCashbox2 += payment.cashbox2Paid ?? 0;
        }
      }
    }

    for (const incomeItem of storeExtraIncomePrevious) {
      previousIncomeChannelsBankTransfer += Number(
        incomeItem.bankTransferPaid ?? 0,
      );
      previousIncomeChannelsCashbox1 += Number(incomeItem.cashbox1Paid ?? 0);
      previousIncomeChannelsCashbox2 += Number(incomeItem.cashbox2Paid ?? 0);
    }

    for (const expense of previousManualAdministrativeExpenses) {
      if (expense.status !== 'PAID') continue;
      addPreviousExpenseByChannelsOrMethod(
        expense,
        Number(expense.amount ?? 0),
        (expense as any).paymentMethod as
          | 'BANK_TRANSFER'
          | 'CASHBOX1'
          | 'CASHBOX2'
          | null,
      );
    }
    for (const expense of previousHouseholdTypeExpenses) {
      if (expense.status !== 'PAID') continue;
      addPreviousExpenseByChannelsOrMethod(
        expense,
        Number(expense.amount ?? 0),
        (expense as any).paymentMethod as
          | 'BANK_TRANSFER'
          | 'CASHBOX1'
          | 'CASHBOX2'
          | null,
      );
    }
    for (const expense of previousStoreFacilitiesExpenses) {
      if (expense.status !== 'PAID') continue;
      addPreviousExpenseByChannelsOrMethod(
        expense,
        Number(expense.amount ?? 0),
        (expense as any).paymentMethod as
          | 'BANK_TRANSFER'
          | 'CASHBOX1'
          | 'CASHBOX2'
          | null,
      );
    }
    for (const expense of previousManualExpenses) {
      if (expense.type !== 'SALARIES' || expense.status !== 'PAID') continue;
      addPreviousExpenseByChannelsOrMethod(
        expense,
        Number(expense.amount ?? 0),
        (expense as any).paymentMethod as
          | 'BANK_TRANSFER'
          | 'CASHBOX1'
          | 'CASHBOX2'
          | null,
      );
    }
    const previousMonthChannels = previousClosingSnapshot.channels;
    const months: Date[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      months.push(startOfMonth(subMonths(period, i)));
    }

    const monthlyByKey = new Map<
      string,
      {
        pavilionsRented: number;
        squareRented: number;
      }
    >();
    for (const monthDate of months) {
      const key = monthDate.toISOString();
      monthlyByKey.set(key, {
        pavilionsRented: 0,
        squareRented: 0,
      });
    }

    const occupiedByLedgerMonth = new Map<string, Set<number>>();
    const occupiedByPaymentMonth = new Map<string, Set<number>>();
    const occupiedByAnyHistoricalSignal = new Set<number>();
    for (const ledger of monthlyLedgers) {
      const monthKey = startOfMonth(ledger.period).toISOString();
      if (Number(ledger.expectedTotal ?? 0) > 0) {
        if (!occupiedByLedgerMonth.has(monthKey)) {
          occupiedByLedgerMonth.set(monthKey, new Set<number>());
        }
        const pavilionId = Number(ledger.pavilionId);
        occupiedByLedgerMonth.get(monthKey)?.add(pavilionId);
        occupiedByAnyHistoricalSignal.add(pavilionId);
      }
    }
    for (const pavilion of trendPavilions) {
      for (const payment of pavilion.payments || []) {
        const monthKey = startOfMonth(payment.period).toISOString();
        if (!occupiedByPaymentMonth.has(monthKey)) {
          occupiedByPaymentMonth.set(monthKey, new Set<number>());
        }
        const pavilionId = Number(pavilion.id);
        occupiedByPaymentMonth.get(monthKey)?.add(pavilionId);
        occupiedByAnyHistoricalSignal.add(pavilionId);
      }
    }

    for (const monthDate of months) {
      const key = monthDate.toISOString();
      const bucket = monthlyByKey.get(key);
      if (!bucket) continue;
      const { monthStart, monthEnd } = this.getTimeZoneMonthRange(monthDate, storeTimeZone);
      const isFirstTrendMonth = monthDate.getTime() === months[0]?.getTime();
      const monthStartKey = this.getDateKeyInTimeZone(monthStart, storeTimeZone);
      const monthEndKey = this.getDateKeyInTimeZone(monthEnd, storeTimeZone);
      const occupiedByLedger = occupiedByLedgerMonth.get(key) ?? new Set<number>();
      const occupiedByPayment = occupiedByPaymentMonth.get(key) ?? new Set<number>();

      for (const pavilion of trendPavilions) {
        const pavilionId = Number(pavilion.id);
        const pavilionCreatedAt = pavilionCreatedAtById.get(pavilionId);
        if (pavilionCreatedAt && pavilionCreatedAt.getTime() > monthEnd.getTime()) {
          continue;
        }
        const occupiedByLease = (pavilion.leases || []).some((lease) => {
          if (lease.status === 'CANCELLED') return false;
          const startsOn = String(lease.startsOn ?? '').trim();
          const endsOn = String(lease.vacatedOn ?? lease.endsOn ?? '').trim();
          const leaseStartKey =
            startsOn.length > 0
              ? startsOn
              : this.getDateKeyInTimeZone(new Date(lease.createdAt), storeTimeZone);
          const leaseEndKey = endsOn.length > 0 ? endsOn : null;
          return leaseStartKey <= monthEndKey && (!leaseEndKey || leaseEndKey >= monthStartKey);
        });
        const occupiedByFirstMonthFallback =
          isFirstTrendMonth &&
          (pavilion.status === PavilionStatus.RENTED ||
            pavilion.status === PavilionStatus.PREPAID) &&
          occupiedByAnyHistoricalSignal.has(pavilionId);

        if (
          !occupiedByLease &&
          !occupiedByLedger.has(pavilionId) &&
          !occupiedByPayment.has(pavilionId) &&
          !occupiedByFirstMonthFallback
        ) {
          continue;
        }

        bucket.pavilionsRented += 1;
        bucket.squareRented += Number(pavilion.squareMeters ?? 0);
      }
    }

    const monthlyTrend = months.map((monthDate) => {
      const key = monthDate.toISOString();
      const monthData = monthlyByKey.get(key) ?? {
        pavilionsRented: 0,
        squareRented: 0,
      };
      const pavilionsTotal = pavilions.length;
      const squareTotal = areaTotal;
      return {
        period: monthDate,
        pavilionsTotal,
        pavilionsRented: monthData.pavilionsRented,
        pavilionsAvailable: Math.max(0, pavilionsTotal - monthData.pavilionsRented),
        squareTotal,
        squareRented: monthData.squareRented,
        squareAvailable: Math.max(0, squareTotal - monthData.squareRented),
      };
    });

    const manualExpensesForTrend = await this.prisma.pavilionExpense.findMany({
      where: {
        createdAt: {
          gte: trendStart,
          lte: periodRange.monthEnd,
        },
        OR: [{ storeId }, { pavilion: { storeId } }],
      },
      select: {
        createdAt: true,
        amount: true,
        status: true,
      },
    });

    const monthlyFinanceMap = new Map<
      string,
      {
        incomeForecast: number;
        incomeActual: number;
        expensesForecast: number;
        expensesActual: number;
      }
    >();
    for (const monthDate of months) {
      monthlyFinanceMap.set(monthDate.toISOString(), {
        incomeForecast: 0,
        incomeActual: 0,
        expensesForecast: 0,
        expensesActual: 0,
      });
    }

    for (const ledger of monthlyLedgers) {
      const monthKey = startOfMonth(ledger.period).toISOString();
      const bucket = monthlyFinanceMap.get(monthKey);
      if (!bucket) continue;
      bucket.incomeForecast += Number(ledger.expectedTotal ?? 0);
      bucket.incomeActual += Number(ledger.actualTotal ?? 0);
    }
    for (const storeIncome of storeExtraIncomeTrend) {
      const monthKey = startOfMonth(storeIncome.period).toISOString();
      const bucket = monthlyFinanceMap.get(monthKey);
      if (!bucket) continue;
      bucket.incomeActual += Number(storeIncome.amount ?? 0);
    }

    for (const expense of manualExpensesForTrend) {
      const monthKey = startOfMonth(expense.createdAt).toISOString();
      const bucket = monthlyFinanceMap.get(monthKey);
      if (!bucket) continue;
      bucket.expensesForecast += Number(expense.amount ?? 0);
      if (expense.status === 'PAID') {
        bucket.expensesActual += Number(expense.amount ?? 0);
      }
    }

    const currentKey = startOfMonth(period).toISOString();
    if (monthlyFinanceMap.has(currentKey)) {
      const current = monthlyFinanceMap.get(currentKey);
      if (current) {
        current.incomeForecast = incomeForecastTotal;
        current.incomeActual = incomeActualTotal;
        current.expensesForecast = expensesTotalForecast;
        current.expensesActual = expensesTotalActual;
      }
    }

    const monthlyFinanceTrend = months.map((monthDate) => {
      const key = monthDate.toISOString();
      const month = monthlyFinanceMap.get(key) ?? {
        incomeForecast: 0,
        incomeActual: 0,
        expensesForecast: 0,
        expensesActual: 0,
      };

      return {
        period: monthDate,
        incomeForecast: month.incomeForecast,
        incomeActual: month.incomeActual,
        expensesForecast: month.expensesForecast,
        expensesActual: month.expensesActual,
        saldo: month.incomeActual - month.expensesActual,
      };
    });

    const selectedMonthTradeArea =
      monthlyTrend.find(
        (item) => startOfMonth(item.period).getTime() === startOfMonth(period).getTime(),
      ) ?? monthlyTrend[monthlyTrend.length - 1];

    return {
      pavilions: {
        total: pavilions.length,
        rented:
          selectedMonthTradeArea?.pavilionsRented ??
          pavilions.filter((p) => p.status === 'RENTED').length,
        free:
          selectedMonthTradeArea?.pavilionsAvailable ??
          pavilions.filter((p) => p.status === 'AVAILABLE').length,
        prepaid: pavilions.filter((p) => p.status === 'PREPAID').length,
      },
      forecastIncome: {
        rent: forecastRent,
        utilities: forecastUtilities,
        advertising: forecastAdvertising,
        additional: forecastAdditional,
        storeExtra: forecastStoreExtra,
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
        storeExtra: forecastStoreExtra,
        total: forecastTotal,
      },
      paid: {
        rent: actualRent,
        utilities: actualUtilities,
        advertising: actualAdvertising,
        additional: actualAdditional,
        storeExtra: actualStoreExtra,
        total: actualTotal,
      },
      debt: forecastTotal - actualTotal,
      income: {
        forecast: {
          rent: incomeForecastRent,
          utilities: incomeForecastUtilities,
          advertising: incomeForecastAdvertising,
          additional: incomeForecastAdditional,
          storeExtra: incomeForecastStoreExtra,
          total: incomeForecastTotal,
        },
        actual: {
          rent: incomeActualRent,
          utilities: incomeActualUtilities,
          advertising: incomeActualAdvertising,
          additional: incomeActualAdditional,
          storeExtra: incomeActualStoreExtra,
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
          forecast: {
            rent: incomeForecastRent,
            facilities: incomeForecastUtilities,
            advertising: incomeForecastAdvertising,
            additional: incomeForecastAdditional,
            storeExtra: incomeForecastStoreExtra,
            total: incomeForecastTotal,
          },
          rent: actualRent,
          facilities: actualUtilities,
          advertising: actualAdvertising,
          additional: actualAdditional,
          storeExtra: incomeActualStoreExtra,
          total: overallIncomeTotal,
          previousMonthBalance,
          previousMonthChannels,
          carryAdjustment,
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
            additional: {
              bankTransfer: additionalChannelsBankTransfer,
              cashbox1: additionalChannelsCashbox1,
              cashbox2: additionalChannelsCashbox2,
              total:
                additionalChannelsBankTransfer +
                additionalChannelsCashbox1 +
                additionalChannelsCashbox2,
            },
            storeExtra: {
              bankTransfer: storeExtraChannelsBankTransfer,
              cashbox1: storeExtraChannelsCashbox1,
              cashbox2: storeExtraChannelsCashbox2,
              total:
                storeExtraChannelsBankTransfer +
                storeExtraChannelsCashbox1 +
                storeExtraChannelsCashbox2,
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
              status: householdStatus,
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
          channels: {
            bankTransfer: expenseChannelsBankTransfer,
            cashbox1: expenseChannelsCashbox1,
            cashbox2: expenseChannelsCashbox2,
            total:
              expenseChannelsBankTransfer +
              expenseChannelsCashbox1 +
              expenseChannelsCashbox2,
          },
          channelsByType: {
            salaries: {
              ...expenseChannelsByType.SALARIES,
              total:
                expenseChannelsByType.SALARIES.bankTransfer +
                expenseChannelsByType.SALARIES.cashbox1 +
                expenseChannelsByType.SALARIES.cashbox2,
            },
            payrollTax: {
              ...expenseChannelsByType.PAYROLL_TAX,
              total:
                expenseChannelsByType.PAYROLL_TAX.bankTransfer +
                expenseChannelsByType.PAYROLL_TAX.cashbox1 +
                expenseChannelsByType.PAYROLL_TAX.cashbox2,
            },
            profitTax: {
              ...expenseChannelsByType.PROFIT_TAX,
              total:
                expenseChannelsByType.PROFIT_TAX.bankTransfer +
                expenseChannelsByType.PROFIT_TAX.cashbox1 +
                expenseChannelsByType.PROFIT_TAX.cashbox2,
            },
            dividends: {
              ...expenseChannelsByType.DIVIDENDS,
              total:
                expenseChannelsByType.DIVIDENDS.bankTransfer +
                expenseChannelsByType.DIVIDENDS.cashbox1 +
                expenseChannelsByType.DIVIDENDS.cashbox2,
            },
            bankServices: {
              ...expenseChannelsByType.BANK_SERVICES,
              total:
                expenseChannelsByType.BANK_SERVICES.bankTransfer +
                expenseChannelsByType.BANK_SERVICES.cashbox1 +
                expenseChannelsByType.BANK_SERVICES.cashbox2,
            },
            vat: {
              ...expenseChannelsByType.VAT,
              total:
                expenseChannelsByType.VAT.bankTransfer +
                expenseChannelsByType.VAT.cashbox1 +
                expenseChannelsByType.VAT.cashbox2,
            },
            landRent: {
              ...expenseChannelsByType.LAND_RENT,
              total:
                expenseChannelsByType.LAND_RENT.bankTransfer +
                expenseChannelsByType.LAND_RENT.cashbox1 +
                expenseChannelsByType.LAND_RENT.cashbox2,
            },
            other: {
              ...expenseChannelsByType.OTHER,
              total:
                expenseChannelsByType.OTHER.bankTransfer +
                expenseChannelsByType.OTHER.cashbox1 +
                expenseChannelsByType.OTHER.cashbox2,
            },
            facilities: {
              ...expenseChannelsByType.STORE_FACILITIES,
              total:
                expenseChannelsByType.STORE_FACILITIES.bankTransfer +
                expenseChannelsByType.STORE_FACILITIES.cashbox1 +
                expenseChannelsByType.STORE_FACILITIES.cashbox2,
            },
            household: {
              ...expenseChannelsByType.HOUSEHOLD,
              total:
                expenseChannelsByType.HOUSEHOLD.bankTransfer +
                expenseChannelsByType.HOUSEHOLD.cashbox1 +
                expenseChannelsByType.HOUSEHOLD.cashbox2,
            },
          },
        },
        saldo,
        saldoChannels: {
          bankTransfer: channelsBankTransfer - expenseChannelsBankTransfer,
          cashbox1: channelsCashbox1 - expenseChannelsCashbox1,
          cashbox2: channelsCashbox2 - expenseChannelsCashbox2,
          total:
            channelsBankTransfer +
            channelsCashbox1 +
            channelsCashbox2 -
            (expenseChannelsBankTransfer +
              expenseChannelsCashbox1 +
              expenseChannelsCashbox2),
        },
                tradeArea: {
          pavilionsTotal: pavilions.length,
          pavilionsRented: selectedMonthTradeArea?.pavilionsRented ?? 0,
          pavilionsAvailable:
            selectedMonthTradeArea?.pavilionsAvailable ?? pavilions.length,
          squareTotal: areaTotal,
          squareRented: selectedMonthTradeArea?.squareRented ?? 0,
          squareAvailable: selectedMonthTradeArea?.squareAvailable ?? areaTotal,
          monthlyTrend,
        },
        groupedByPavilionGroups: groupSummaries,
        financeTrend: monthlyFinanceTrend,
      },
      period,
    };
  }

  async getIncomeForecastBreakdown(storeId: number, periodInput?: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { timeZone: true },
    });
    const storeTimeZone = this.normalizeStoreTimeZone(store?.timeZone);
    const currentPeriod = this.getCurrentMonthPeriodInTimeZone(storeTimeZone);

    await this.prisma.pavilion.updateMany({
      where: {
        storeId,
        status: PavilionStatus.PREPAID,
        prepaidUntil: {
          lt: currentPeriod,
        },
      },
      data: {
        status: PavilionStatus.RENTED,
        prepaidUntil: null,
      },
    });

    const period = this.parsePeriod(periodInput, storeTimeZone);
    const periodRange = this.getTimeZoneMonthRange(period, storeTimeZone);
    const additionalChargesForecastRows = await this.prisma.additionalCharge.findMany({
      where: {
        createdAt: {
          gte: periodRange.monthStart,
          lte: periodRange.monthEnd,
        },
        pavilion: {
          storeId,
        },
      },
      select: {
        pavilionId: true,
        amount: true,
      },
    });
    const additionalForecastByPavilion = additionalChargesForecastRows.reduce(
      (map, row) => {
        const pavilionKey = Number(row.pavilionId);
        map.set(pavilionKey, (map.get(pavilionKey) ?? 0) + Number(row.amount ?? 0));
        return map;
      },
      new Map<number, number>(),
    );
    const storeExtraIncomeRepo = (this.prisma as any).storeExtraIncome;
    const storeExtraIncome = storeExtraIncomeRepo?.findMany
      ? await storeExtraIncomeRepo.findMany({
          where: {
            storeId,
            period,
          },
          orderBy: [{ paidAt: 'asc' }, { id: 'asc' }],
        })
      : [];

    const pavilions = await this.prisma.pavilion.findMany({
      where: { storeId },
      include: {
        monthlyLedgers: {
          where: { period },
          take: 1,
        },
        discounts: true,
        additionalCharges: {
          where: {
            createdAt: {
              gte: periodRange.monthStart,
              lte: periodRange.monthEnd,
            },
          },
        },
      },
      orderBy: [{ number: 'asc' }, { id: 'asc' }],
    });

    const incomePavilions = pavilions.filter(
      (p) => p.status === PavilionStatus.RENTED || p.status === PavilionStatus.PREPAID,
    );

    const items = incomePavilions.map((pavilion) => {
      const currentLedger = pavilion.monthlyLedgers[0];
      const currentAdditionalForecast =
        pavilion.status === PavilionStatus.RENTED
          ? Number(additionalForecastByPavilion.get(Number(pavilion.id)) ?? 0)
          : 0;
      if (currentLedger) {
        const rent = Number(currentLedger.expectedRent ?? 0);
        const utilities = Number(currentLedger.expectedUtilities ?? 0);
        const advertising = Number(currentLedger.expectedAdvertising ?? 0);
        const additional = currentAdditionalForecast;
        return {
          pavilionId: pavilion.id,
          number: pavilion.number,
          tenantName: pavilion.tenantName,
          status: pavilion.status,
          rent,
          utilities,
          advertising,
          additional,
          total: rent + utilities + advertising + additional,
        };
      }

      const baseRent = pavilion.squareMeters * pavilion.pricePerSqM;
      const monthlyDiscount =
        pavilion.status === PavilionStatus.PREPAID
          ? 0
          : this.getMonthlyDiscountTotal(pavilion.discounts, pavilion.squareMeters, period);
      const rent =
        pavilion.status === PavilionStatus.PREPAID
          ? baseRent
          : Math.max(baseRent - monthlyDiscount, 0);
      const utilities = pavilion.status === PavilionStatus.RENTED ? Number(pavilion.utilitiesAmount ?? 0) : 0;
      const advertising =
        pavilion.status === PavilionStatus.RENTED ? Number(pavilion.advertisingAmount ?? 0) : 0;
      const additional =
        currentAdditionalForecast;

      return {
        pavilionId: pavilion.id,
        number: pavilion.number,
        tenantName: pavilion.tenantName,
        status: pavilion.status,
        rent,
        utilities,
        advertising,
        additional,
        total: rent + utilities + advertising + additional,
      };
    });

    const totals = items.reduce(
      (acc, item) => {
        acc.rent += item.rent;
        acc.utilities += item.utilities;
        acc.advertising += item.advertising;
        acc.additional += item.additional;
        acc.total += item.total;
        return acc;
      },
      {
        rent: 0,
        utilities: 0,
        advertising: 0,
        additional: 0,
        storeExtra: 0,
        total: 0,
      },
    );
    const storeItems = storeExtraIncome.map((income) => ({
      id: income.id,
      name: income.name,
      amount: Number(income.amount ?? 0),
      bankTransferPaid: Number(income.bankTransferPaid ?? 0),
      cashbox1Paid: Number(income.cashbox1Paid ?? 0),
      cashbox2Paid: Number(income.cashbox2Paid ?? 0),
      paidAt: income.paidAt,
    }));
    const storeExtraTotal = storeItems.reduce((sum, item) => sum + item.amount, 0);
    totals.storeExtra = storeExtraTotal;
    totals.total += storeExtraTotal;

    return {
      period,
      totals,
      items,
      storeItems,
    };
  }

  private parsePeriod(periodInput?: string, timeZone = 'UTC') {
    if (!periodInput) {
      return this.getCurrentMonthPeriodInTimeZone(timeZone);
    }

    const match = /^(\d{4})-(\d{2})$/.exec(periodInput.trim());
    if (!match) {
      throw new BadRequestException('period must be in YYYY-MM format');
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('period must be in YYYY-MM format');
    }

    return startOfMonth(new Date(year, month - 1, 1));
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
        return sum + discount.amount;
      }

      return sum;
    }, 0);
  }
}

import { PavilionStatus } from '@prisma/client';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const makePrismaMock = () => {
    const storeFindUnique = jest.fn();
    const pavilionUpdateMany = jest.fn();
    const pavilionFindMany = jest.fn();
    const pavilionExpenseFindMany = jest.fn();
    const additionalChargeFindMany = jest.fn();
    const pavilionMonthlyLedgerFindMany = jest.fn();
    const pavilionMonthlyLedgerAggregate = jest.fn();
    const paymentFindMany = jest.fn();
    const additionalChargePaymentFindMany = jest.fn();
    const storeExtraIncomeFindMany = jest.fn();

    return {
      store: { findUnique: storeFindUnique },
      pavilion: { updateMany: pavilionUpdateMany, findMany: pavilionFindMany },
      payment: { findMany: paymentFindMany },
      additionalChargePayment: { findMany: additionalChargePaymentFindMany },
      storeExtraIncome: { findMany: storeExtraIncomeFindMany },
      pavilionExpense: { findMany: pavilionExpenseFindMany },
      additionalCharge: { findMany: additionalChargeFindMany },
      pavilionMonthlyLedger: {
        findMany: pavilionMonthlyLedgerFindMany,
        aggregate: pavilionMonthlyLedgerAggregate,
      },
    };
  };

  it('calculates income/expenses/saldo/channels and previous month balance correctly', async () => {
    const prisma = makePrismaMock();

    prisma.store.findUnique
      .mockResolvedValueOnce({
        utilitiesExpenseStatus: 'UNPAID',
        householdExpenseStatus: 'UNPAID',
        staff: [{ salary: 1000, salaryStatus: 'PAID' }],
      })
      .mockResolvedValueOnce({
        utilitiesExpenseStatus: 'UNPAID',
        householdExpenseStatus: 'UNPAID',
        staff: [{ salary: 1000, salaryStatus: 'PAID' }],
      });

    prisma.pavilion.updateMany.mockResolvedValue({ count: 0 });

    prisma.pavilion.findMany
      .mockResolvedValueOnce([
        {
          status: PavilionStatus.RENTED,
          squareMeters: 10,
          pricePerSqM: 100,
          utilitiesAmount: 80,
          advertisingAmount: 20,
          discounts: [],
          monthlyLedgers: [],
          payments: [
            {
              rentPaid: 1000,
              utilitiesPaid: 200,
              advertisingPaid: 100,
              bankTransferPaid: 0,
              cashbox1Paid: 0,
              cashbox2Paid: 0,
              rentBankTransferPaid: 600,
              rentCashbox1Paid: 300,
              rentCashbox2Paid: 100,
              utilitiesBankTransferPaid: 100,
              utilitiesCashbox1Paid: 100,
              utilitiesCashbox2Paid: 0,
              advertisingBankTransferPaid: 40,
              advertisingCashbox1Paid: 60,
              advertisingCashbox2Paid: 0,
            },
          ],
          additionalCharges: [
            {
              amount: 150,
              payments: [
                {
                  amountPaid: 50,
                  bankTransferPaid: 20,
                  cashbox1Paid: 30,
                  cashbox2Paid: 0,
                },
              ],
            },
          ],
          groupMemberships: [
            {
              group: {
                id: 1,
                name: 'Группа 1',
              },
            },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          status: PavilionStatus.RENTED,
          payments: [{ rentPaid: 500, utilitiesPaid: 50, advertisingPaid: 50 }],
          additionalCharges: [
            {
              payments: [{ amountPaid: 25 }],
            },
          ],
        },
      ]);

    prisma.pavilionExpense.findMany
      .mockResolvedValueOnce([
        { type: 'PAYROLL_TAX', amount: 300, status: 'PAID' },
        { type: 'OTHER', amount: 100, status: 'PAID' },
        { type: 'HOUSEHOLD', amount: 200, status: 'PAID' },
        { type: 'STORE_FACILITIES', amount: 400, status: 'UNPAID' },
      ])
      .mockResolvedValueOnce([
        { type: 'PAYROLL_TAX', amount: 100, status: 'PAID' },
        { type: 'HOUSEHOLD', amount: 50, status: 'PAID' },
        { type: 'STORE_FACILITIES', amount: 40, status: 'PAID' },
      ])
      .mockResolvedValueOnce([
        { type: 'PAYROLL_TAX', amount: 100, status: 'PAID' },
        { type: 'HOUSEHOLD', amount: 50, status: 'PAID' },
        { type: 'STORE_FACILITIES', amount: 40, status: 'PAID' },
      ])
      .mockResolvedValue([
        {
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
          amount: 300,
          status: 'PAID',
        },
      ]);

    prisma.additionalCharge.findMany.mockResolvedValue([]);
    prisma.pavilionMonthlyLedger.findMany.mockResolvedValue([]);
    prisma.pavilionMonthlyLedger.aggregate.mockResolvedValue({
      _sum: { closingDebt: 0 },
    });
    prisma.payment.findMany.mockResolvedValue([
      {
        rentPaid: 500,
        utilitiesPaid: 50,
        advertisingPaid: 50,
        bankTransferPaid: 0,
        cashbox1Paid: 0,
        cashbox2Paid: 0,
        rentBankTransferPaid: 500,
        rentCashbox1Paid: 0,
        rentCashbox2Paid: 0,
        utilitiesBankTransferPaid: 0,
        utilitiesCashbox1Paid: 50,
        utilitiesCashbox2Paid: 0,
        advertisingBankTransferPaid: 0,
        advertisingCashbox1Paid: 50,
        advertisingCashbox2Paid: 0,
      },
    ]);
    prisma.additionalChargePayment.findMany.mockResolvedValue([
      {
        amountPaid: 25,
        bankTransferPaid: 25,
        cashbox1Paid: 0,
        cashbox2Paid: 0,
      },
    ]);
    prisma.storeExtraIncome.findMany.mockResolvedValue([]);

    const service = new AnalyticsService(prisma as any);
    const result = await service.getStoreAnalytics(2);

    expect(result.income.actual.total).toBe(1350);
    expect(result.summaryPage.income.total).toBe(1350);
    expect(result.summaryPage.income.channels).toEqual({
      bankTransfer: 760,
      cashbox1: 490,
      cashbox2: 100,
      total: 1350,
    });

    expect(result.expenses.total.forecast).toBe(2000);
    expect(result.expenses.total.actual).toBe(1600);
    expect(result.summaryPage.expenses.totals.actual).toBe(1600);

    expect(result.summaryPage.saldo).toBe(-250);
    expect(result.summaryPage.income.previousMonthBalance).toBe(435);

    expect(result.summaryPage.groupedByPavilionGroups).toHaveLength(1);
    expect(result.summaryPage.groupedByPavilionGroups[0]).toMatchObject({
      name: 'Группа 1',
      forecastIncome: 1250,
      actualIncome: 1350,
      delta: 100,
    });
  });

  it('uses previous month closing saldo as carry-over for the next month', async () => {
    const prisma = makePrismaMock();

    prisma.store.findUnique
      .mockResolvedValueOnce({
        utilitiesExpenseStatus: 'UNPAID',
        householdExpenseStatus: 'UNPAID',
        staff: [],
      })
      .mockResolvedValueOnce({
        utilitiesExpenseStatus: 'UNPAID',
        householdExpenseStatus: 'UNPAID',
        staff: [],
      });

    prisma.pavilion.updateMany.mockResolvedValue({ count: 0 });
    prisma.pavilion.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.pavilionExpense.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          amount: 250,
          status: 'PAID',
          bankTransferPaid: 250,
          cashbox1Paid: 0,
          cashbox2Paid: 0,
          paymentMethod: 'BANK_TRANSFER',
        },
      ])
      .mockResolvedValue([
        {
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
          amount: 250,
          status: 'PAID',
        },
      ]);
    prisma.additionalCharge.findMany.mockResolvedValue([]);
    prisma.pavilionMonthlyLedger.findMany.mockResolvedValue([]);
    prisma.pavilionMonthlyLedger.aggregate.mockResolvedValue({ _sum: { closingDebt: 0 } });
    prisma.payment.findMany.mockResolvedValue([
      {
        rentPaid: 1000,
        utilitiesPaid: 100,
        advertisingPaid: 50,
        bankTransferPaid: 0,
        cashbox1Paid: 0,
        cashbox2Paid: 0,
        rentBankTransferPaid: 700,
        rentCashbox1Paid: 300,
        rentCashbox2Paid: 0,
        utilitiesBankTransferPaid: 100,
        utilitiesCashbox1Paid: 0,
        utilitiesCashbox2Paid: 0,
        advertisingBankTransferPaid: 0,
        advertisingCashbox1Paid: 50,
        advertisingCashbox2Paid: 0,
      },
      {
        rentPaid: 500,
        utilitiesPaid: 0,
        advertisingPaid: 0,
        bankTransferPaid: 0,
        cashbox1Paid: 0,
        cashbox2Paid: 0,
        rentBankTransferPaid: 500,
        rentCashbox1Paid: 0,
        rentCashbox2Paid: 0,
        utilitiesBankTransferPaid: 0,
        utilitiesCashbox1Paid: 0,
        utilitiesCashbox2Paid: 0,
        advertisingBankTransferPaid: 0,
        advertisingCashbox1Paid: 0,
        advertisingCashbox2Paid: 0,
      },
    ]);
    prisma.additionalChargePayment.findMany.mockResolvedValue([]);
    prisma.storeExtraIncome.findMany.mockResolvedValue([]);

    const service = new AnalyticsService(prisma as any);
    const result = await service.getStoreAnalytics(2);

    expect(result.summaryPage.income.previousMonthBalance).toBe(1400);
    expect(result.summaryPage.income.previousMonthChannels).toEqual({
      bankTransfer: 1050,
      cashbox1: 350,
      cashbox2: 0,
      total: 1400,
    });
  });
});

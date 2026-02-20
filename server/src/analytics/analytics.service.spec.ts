import { AnalyticsService } from './analytics.service';

jest.mock(
  'src/prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-15T10:00:00.000Z'));

    prisma = {
      store: {
        findUnique: jest.fn(),
      },
      pavilion: {
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      pavilionExpense: {
        findMany: jest.fn(),
      },
    };

    service = new AnalyticsService(prisma);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('calculates summary saldo from actual income minus actual expenses', async () => {
    prisma.store.findUnique
      .mockResolvedValueOnce({
        utilitiesExpenseStatus: 'UNPAID',
        householdExpenseStatus: 'UNPAID',
        staff: [{ salary: 500, salaryStatus: 'PAID' }],
      })
      .mockResolvedValueOnce({
        utilitiesExpenseStatus: 'UNPAID',
        householdExpenseStatus: 'UNPAID',
        staff: [{ salary: 200, salaryStatus: 'PAID' }],
      });

    prisma.pavilion.updateMany.mockResolvedValue({ count: 0 });
    prisma.pavilion.findMany
      .mockResolvedValueOnce([
        {
          id: 1,
          status: 'RENTED',
          squareMeters: 10,
          pricePerSqM: 100,
          utilitiesAmount: 50,
          advertisingAmount: 30,
          discounts: [],
          monthlyLedgers: [],
          payments: [
            {
              rentPaid: 800,
              utilitiesPaid: 40,
              advertisingPaid: 10,
              rentBankTransferPaid: 800,
              rentCashbox1Paid: 0,
              rentCashbox2Paid: 0,
              utilitiesBankTransferPaid: 40,
              utilitiesCashbox1Paid: 0,
              utilitiesCashbox2Paid: 0,
              advertisingBankTransferPaid: 10,
              advertisingCashbox1Paid: 0,
              advertisingCashbox2Paid: 0,
              bankTransferPaid: 0,
              cashbox1Paid: 0,
              cashbox2Paid: 0,
            },
          ],
          additionalCharges: [
            {
              amount: 20,
              payments: [
                {
                  amountPaid: 5,
                  bankTransferPaid: 5,
                  cashbox1Paid: 0,
                  cashbox2Paid: 0,
                },
              ],
            },
          ],
          groupMemberships: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          status: 'RENTED',
          payments: [{ rentPaid: 300, utilitiesPaid: 0, advertisingPaid: 0 }],
          additionalCharges: [],
        },
      ]);

    prisma.pavilionExpense.findMany
      .mockResolvedValueOnce([
        { type: 'PAYROLL_TAX', amount: 100, status: 'PAID' },
        { type: 'STORE_FACILITIES', amount: 70, status: 'UNPAID' },
        { type: 'HOUSEHOLD', amount: 30, status: 'PAID' },
      ])
      .mockResolvedValueOnce([
        { type: 'PAYROLL_TAX', amount: 50, status: 'PAID' },
        { type: 'STORE_FACILITIES', amount: 10, status: 'PAID' },
        { type: 'HOUSEHOLD', amount: 40, status: 'PAID' },
      ]);

    const result = await service.getStoreAnalytics(10);

    expect(result.summaryPage.income.total).toBe(855);
    expect(result.summaryPage.expenses.totals.actual).toBe(630);
    expect(result.summaryPage.saldo).toBe(225);
    expect(result.summaryPage.income.previousMonthBalance).toBe(0);
  });

  it('aggregates payment channels by entity and supports old fallback payment fields', async () => {
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
    prisma.pavilion.findMany
      .mockResolvedValueOnce([
        {
          id: 1,
          status: 'RENTED',
          squareMeters: 10,
          pricePerSqM: 100,
          utilitiesAmount: 0,
          advertisingAmount: 0,
          discounts: [],
          monthlyLedgers: [],
          payments: [
            {
              // old style record: only generic rent channels used
              rentPaid: 300,
              utilitiesPaid: 0,
              advertisingPaid: 0,
              rentBankTransferPaid: 0,
              rentCashbox1Paid: 0,
              rentCashbox2Paid: 0,
              utilitiesBankTransferPaid: 0,
              utilitiesCashbox1Paid: 0,
              utilitiesCashbox2Paid: 0,
              advertisingBankTransferPaid: 0,
              advertisingCashbox1Paid: 0,
              advertisingCashbox2Paid: 0,
              bankTransferPaid: 100,
              cashbox1Paid: 200,
              cashbox2Paid: 0,
            },
            {
              // new style record: split by entity
              rentPaid: 50,
              utilitiesPaid: 30,
              advertisingPaid: 20,
              rentBankTransferPaid: 10,
              rentCashbox1Paid: 20,
              rentCashbox2Paid: 20,
              utilitiesBankTransferPaid: 5,
              utilitiesCashbox1Paid: 10,
              utilitiesCashbox2Paid: 15,
              advertisingBankTransferPaid: 3,
              advertisingCashbox1Paid: 7,
              advertisingCashbox2Paid: 10,
              bankTransferPaid: 0,
              cashbox1Paid: 0,
              cashbox2Paid: 0,
            },
          ],
          additionalCharges: [
            {
              amount: 0,
              payments: [
                {
                  amountPaid: 10,
                  bankTransferPaid: 2,
                  cashbox1Paid: 3,
                  cashbox2Paid: 5,
                },
              ],
            },
          ],
          groupMemberships: [],
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.pavilionExpense.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.getStoreAnalytics(10);

    expect(result.summaryPage.income.channelsByEntity.rent).toEqual({
      bankTransfer: 110,
      cashbox1: 220,
      cashbox2: 20,
      total: 350,
    });
    expect(result.summaryPage.income.channelsByEntity.facilities).toEqual({
      bankTransfer: 5,
      cashbox1: 10,
      cashbox2: 15,
      total: 30,
    });
    expect(result.summaryPage.income.channelsByEntity.advertising).toEqual({
      bankTransfer: 3,
      cashbox1: 7,
      cashbox2: 10,
      total: 20,
    });
    expect(result.summaryPage.income.channelsByEntity.additional).toEqual({
      bankTransfer: 2,
      cashbox1: 3,
      cashbox2: 5,
      total: 10,
    });
    expect(result.summaryPage.income.channels.total).toBe(410);
  });
});

import { StoresService } from './stores.service';
import { startOfMonth } from 'date-fns';

describe('StoresService monthly rollover', () => {
  let service: StoresService;
  let prisma: any;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-10T10:00:00.000Z'));

    prisma = {
      storeUser: {
        findMany: jest.fn(),
      },
      store: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      pavilion: {
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      pavilionMonthlyLedger: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        pavilionMonthlyLedger: prisma.pavilionMonthlyLedger,
        pavilion: prisma.pavilion,
        store: prisma.store,
      }),
    );

    service = new StoresService(prisma);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('keeps historical payment/debt data and writes previous month ledger', async () => {
    prisma.pavilion.updateMany.mockResolvedValue({ count: 1 });
    prisma.store.findUnique.mockResolvedValue({
      id: 10,
      lastMonthlyResetPeriod: null,
    });
    prisma.pavilion.findMany.mockResolvedValue([
      {
        id: 101,
        status: 'RENTED',
        squareMeters: 10,
        pricePerSqM: 100,
        utilitiesAmount: 50,
        discounts: [],
        payments: [{ rentPaid: 900, utilitiesPaid: 20 }],
        additionalCharges: [
          {
            amount: 100,
            payments: [{ amountPaid: 30 }],
          },
        ],
        monthlyLedgers: [{ closingDebt: 40 }],
      },
    ]);
    prisma.pavilionMonthlyLedger.upsert.mockResolvedValue({});
    prisma.store.update.mockResolvedValue({});

    await (service as any).runMonthlyRolloverForStore(10);

    expect(prisma.pavilionMonthlyLedger.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.pavilionMonthlyLedger.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          pavilionId: 101,
          openingDebt: 40,
          expectedTotal: 1150,
          actualTotal: 950,
          monthDelta: 200,
          closingDebt: 240,
        }),
      }),
    );
  });

  it('resets monthly values and marks reset period', async () => {
    const currentPeriod = startOfMonth(new Date());
    prisma.pavilion.updateMany.mockResolvedValue({ count: 1 });
    prisma.store.findUnique.mockResolvedValue({
      id: 10,
      lastMonthlyResetPeriod: null,
    });
    prisma.pavilion.findMany.mockResolvedValue([]);
    prisma.store.update.mockResolvedValue({});

    await (service as any).runMonthlyRolloverForStore(10);

    expect(prisma.pavilion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ storeId: 10, status: 'RENTED' }),
        data: { utilitiesAmount: null },
      }),
    );
    expect(prisma.pavilion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ storeId: 10, status: 'PREPAID' }),
        data: { utilitiesAmount: 0 },
      }),
    );
    expect(prisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({
          utilitiesExpenseStatus: 'UNPAID',
          householdExpenseStatus: 'UNPAID',
          lastMonthlyResetPeriod: currentPeriod,
        }),
      }),
    );
  });

  it('changes pavilion status from PREPAID to RENTED when prepaid period expired', async () => {
    const currentPeriod = startOfMonth(new Date());
    prisma.pavilion.updateMany.mockResolvedValue({ count: 2 });
    prisma.store.findUnique.mockResolvedValue({
      id: 10,
      lastMonthlyResetPeriod: currentPeriod,
    });

    await (service as any).runMonthlyRolloverForStore(10);

    expect(prisma.pavilion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storeId: 10,
          status: 'PREPAID',
          prepaidUntil: { lt: currentPeriod },
        }),
        data: {
          status: 'RENTED',
          prepaidUntil: null,
        },
      }),
    );
  });
});

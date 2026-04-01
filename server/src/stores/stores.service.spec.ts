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
      storeStaff: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
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
        storeStaff: prisma.storeStaff,
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
    prisma.storeStaff.findMany.mockResolvedValue([]);
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
    expect(prisma.storeStaff.updateMany).toHaveBeenCalledWith({
      where: { storeId: 10 },
      data: {
        salaryStatus: 'UNPAID',
        salaryPaymentMethod: null,
        salaryBankTransferPaid: 0,
        salaryCashbox1Paid: 0,
        salaryCashbox2Paid: 0,
      },
    });
  });

  it('changes pavilion status from PREPAID to RENTED when prepaid period expired', async () => {
    const currentPeriod = startOfMonth(new Date());
    prisma.pavilion.updateMany.mockResolvedValue({ count: 2 });
    prisma.store.findUnique.mockResolvedValue({
      id: 10,
      lastMonthlyResetPeriod: currentPeriod,
    });
    prisma.storeStaff.findMany.mockResolvedValue([]);
    prisma.pavilionExpense = {
      findMany: jest.fn().mockResolvedValue([]),
    };

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

  it('repairs stale paid staff state after current month reset when no current-month salary entry exists', async () => {
    const currentPeriod = startOfMonth(new Date());
    prisma.pavilion.updateMany.mockResolvedValue({ count: 0 });
    prisma.store.findUnique.mockResolvedValue({
      id: 10,
      timeZone: 'UTC',
      lastMonthlyResetPeriod: currentPeriod,
    });
    prisma.storeStaff.findMany.mockResolvedValue([{ id: 7 }]);
    prisma.pavilionExpense = {
      findMany: jest.fn().mockResolvedValue([]),
    };

    await (service as any).runMonthlyRolloverForStore(10);

    expect(prisma.storeStaff.updateMany).toHaveBeenCalledWith({
      where: {
        storeId: 10,
        id: { in: [7] },
      },
      data: {
        salaryStatus: 'UNPAID',
        salaryPaymentMethod: null,
        salaryBankTransferPaid: 0,
        salaryCashbox1Paid: 0,
        salaryCashbox2Paid: 0,
      },
    });
  });
});

describe('StoresService pavilion groups', () => {
  let service: StoresService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      storeUser: {
        findUnique: jest.fn(),
      },
      pavilionGroup: {
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    service = new StoresService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renames pavilion group when user has permissions', async () => {
    prisma.storeUser.findUnique.mockResolvedValue({
      permissions: ['EDIT_PAVILIONS'],
    });
    prisma.pavilionGroup.findFirst.mockResolvedValue({ id: 7 });
    prisma.pavilionGroup.update.mockResolvedValue({
      id: 7,
      name: 'Новая группа',
    });

    const result = await service.renamePavilionGroup(10, 7, 1, {
      name: '  Новая группа  ',
    });

    expect(prisma.pavilionGroup.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { name: 'Новая группа' },
    });
    expect(result).toEqual({ id: 7, name: 'Новая группа' });
  });

  it('deletes pavilion group when user has permissions', async () => {
    prisma.storeUser.findUnique.mockResolvedValue({
      permissions: ['ASSIGN_PERMISSIONS'],
    });
    prisma.pavilionGroup.findFirst.mockResolvedValue({ id: 9 });
    prisma.pavilionGroup.delete.mockResolvedValue({ id: 9 });

    const result = await service.deletePavilionGroup(10, 9, 1);

    expect(prisma.pavilionGroup.delete).toHaveBeenCalledWith({
      where: { id: 9 },
    });
    expect(result).toEqual({ id: 9 });
  });
});

describe('StoresService expense snapshot', () => {
  let service: StoresService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      store: {
        findUnique: jest.fn(),
      },
      storeExpenseLedger: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      pavilionExpense: {
        findMany: jest.fn(),
      },
    };

    service = new StoresService(prisma as any, {} as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('ignores negative-only ledger reversals in expected close expenses', async () => {
    prisma.store.findUnique.mockResolvedValue({ timeZone: 'UTC' });
    prisma.storeExpenseLedger.aggregate.mockResolvedValue({
      _min: { occurredAt: new Date('2026-04-01T08:00:00.000Z') },
    });
    prisma.storeExpenseLedger.findMany.mockResolvedValue([
      {
        id: 1,
        sourceType: 'STAFF',
        sourceId: 5,
        occurredAt: new Date('2026-04-01T09:00:00.000Z'),
        expenseType: 'SALARIES',
        note: 'STAFF:5:Иван',
        bankTransferPaid: -100,
        cashbox1Paid: 0,
        cashbox2Paid: 0,
      },
    ]);

    const result = await (service as any).getExpenseSnapshotForDay(
      10,
      new Date('2026-04-01T00:00:00.000Z'),
      new Date('2026-04-01T23:59:59.999Z'),
    );

    expect(result.items).toEqual([]);
    expect(result.totals).toEqual({
      bankTransferPaid: 0,
      cashbox1Paid: 0,
      cashbox2Paid: 0,
      total: 0,
    });
  });
});

describe('StoresService accounting day resolution', () => {
  let service: StoresService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      storeAccountingRecord: {
        findMany: jest.fn(),
      },
      storeActivity: {
        findMany: jest.fn(),
      },
    };

    service = new StoresService(prisma as any, {} as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('ignores orphan close record without a valid opening before it', async () => {
    const closeRecord = {
      id: 20,
      storeId: 1,
      recordDate: new Date('2026-03-13T00:00:00.000Z'),
      createdAt: new Date('2026-03-13T10:00:00.000Z'),
      bankTransferPaid: 100,
      cashbox1Paid: 0,
      cashbox2Paid: 0,
    };

    prisma.storeAccountingRecord.findMany.mockResolvedValue([closeRecord]);
    prisma.storeActivity.findMany.mockResolvedValue([
      {
        entityId: 20,
        action: 'CLOSE',
      },
    ]);

    const result = await (service as any).resolveAccountingDayOpenCloseRecords(
      1,
      new Date('2026-03-13T00:00:00.000Z'),
      new Date('2026-03-13T23:59:59.999Z'),
    );

    expect(result.openRecord).toBeNull();
    expect(result.closeRecord).toBeNull();
  });

  it('ignores legacy untyped accounting records for open-close resolution', async () => {
    prisma.storeAccountingRecord.findMany.mockResolvedValue([
      {
        id: 30,
        storeId: 1,
        recordDate: new Date('2026-03-13T00:00:00.000Z'),
        createdAt: new Date('2026-03-13T09:00:00.000Z'),
        bankTransferPaid: 0,
        cashbox1Paid: 500,
        cashbox2Paid: 0,
      },
      {
        id: 31,
        storeId: 1,
        recordDate: new Date('2026-03-13T00:00:00.000Z'),
        createdAt: new Date('2026-03-13T18:00:00.000Z'),
        bankTransferPaid: 0,
        cashbox1Paid: 200,
        cashbox2Paid: 0,
      },
    ]);
    prisma.storeActivity.findMany.mockResolvedValue([]);

    const result = await (service as any).resolveAccountingDayOpenCloseRecords(
      1,
      new Date('2026-03-13T00:00:00.000Z'),
      new Date('2026-03-13T23:59:59.999Z'),
    );

    expect(result.openRecord).toBeNull();
    expect(result.closeRecord).toBeNull();
  });

  it('does not shift UTC day-only accounting date to previous day', () => {
    const prisma = {};
    const service = new StoresService(prisma as any, {} as any);

    const result = (service as any).parseAccountingDay('2026-03-13', 'UTC') as Date;

    expect(result.toISOString()).toBe('2026-03-13T00:00:00.000Z');
  });

  it('collapses same-day expense ledger entries into current net expense items', async () => {
    prisma.storeExpenseLedger = {
      aggregate: jest.fn().mockResolvedValue({
        _min: { occurredAt: new Date('2026-03-13T08:00:00.000Z') },
      }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 1,
          sourceType: 'HOUSEHOLD_EXPENSE',
          sourceId: 101,
          occurredAt: new Date('2026-03-13T08:00:00.000Z'),
          expenseType: 'HOUSEHOLD',
          note: 'Хоз расход',
          bankTransferPaid: 0,
          cashbox1Paid: 1000,
          cashbox2Paid: 0,
        },
        {
          id: 2,
          sourceType: 'HOUSEHOLD_EXPENSE',
          sourceId: 101,
          occurredAt: new Date('2026-03-13T08:30:00.000Z'),
          expenseType: 'HOUSEHOLD',
          note: 'Хоз расход',
          bankTransferPaid: 0,
          cashbox1Paid: -1000,
          cashbox2Paid: 0,
        },
        {
          id: 3,
          sourceType: 'HOUSEHOLD_EXPENSE',
          sourceId: 102,
          occurredAt: new Date('2026-03-13T09:00:00.000Z'),
          expenseType: 'HOUSEHOLD',
          note: 'Хоз расход',
          bankTransferPaid: 0,
          cashbox1Paid: 1000,
          cashbox2Paid: 0,
        },
      ]),
    };
    jest.spyOn(service as any, 'getStoreTimeZone').mockResolvedValue('UTC');

    const result = await (service as any).getExpenseSnapshotForDay(
      1,
      new Date('2026-03-13T00:00:00.000Z'),
      new Date('2026-03-13T23:59:59.999Z'),
    );

    expect(result.totals.cashbox1Paid).toBe(1000);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 102,
      note: 'Хоз расход',
      cashbox1Paid: 1000,
      total: 1000,
    });
  });
});

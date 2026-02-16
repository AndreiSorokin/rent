jest.mock('src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}), { virtual: true });

import { PaymentsService } from './payments.service';

describe('PaymentsService discounts', () => {
  let service: PaymentsService;
  let prisma: any;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-10T10:00:00.000Z'));

    prisma = {
      pavilion: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      pavilionMonthlyLedger: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      paymentTransaction: {
        create: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    service = new PaymentsService(prisma);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('does not apply discount when its end date is before current month', async () => {
    const pavilion = {
      id: 22,
      status: 'RENTED',
      prepaidUntil: null,
      squareMeters: 10,
      pricePerSqM: 100,
      utilitiesAmount: 0,
      discounts: [
        {
          amount: 10,
          startsAt: new Date('2026-01-01T00:00:00.000Z'),
          endsAt: new Date('2026-02-20T00:00:00.000Z'),
        },
      ],
      payments: [{ rentPaid: 500, utilitiesPaid: 0 }],
      additionalCharges: [],
    };

    prisma.pavilion.findUnique
      .mockResolvedValueOnce(pavilion)
      .mockResolvedValueOnce(pavilion);
    prisma.pavilionMonthlyLedger.findUnique.mockResolvedValue({
      closingDebt: 0,
    });
    prisma.pavilionMonthlyLedger.upsert.mockImplementation(
      async ({ create }: any) => create,
    );

    const summary = await service.getMonthlySummary(22, new Date('2026-03-05T00:00:00.000Z'));

    expect(summary.expected.discount).toBe(0);
    expect(prisma.pavilionMonthlyLedger.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          expectedRent: 1000,
        }),
      }),
    );
  });
});

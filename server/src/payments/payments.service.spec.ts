import { BadRequestException } from '@nestjs/common';
import { PavilionStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const makePrismaMock = () => {
    const pavilionFindUnique = jest.fn();
    const pavilionUpdate = jest.fn();
    const paymentFindUnique = jest.fn();
    const paymentCreate = jest.fn();
    const paymentUpdate = jest.fn();
    const paymentTransactionCreate = jest.fn();
    const pavilionMonthlyLedgerFindUnique = jest.fn();
    const pavilionMonthlyLedgerUpsert = jest.fn();

    return {
      pavilion: {
        findUnique: pavilionFindUnique,
        update: pavilionUpdate,
      },
      payment: {
        findUnique: paymentFindUnique,
        create: paymentCreate,
        update: paymentUpdate,
      },
      paymentTransaction: {
        create: paymentTransactionCreate,
      },
      pavilionMonthlyLedger: {
        findUnique: pavilionMonthlyLedgerFindUnique,
        upsert: pavilionMonthlyLedgerUpsert,
      },
      $transaction: jest.fn(),
    };
  };

  it('throws when rentPaid does not equal rent channels total', async () => {
    const prisma = makePrismaMock();
    const service = new PaymentsService(prisma as any);

    await expect(
      service.addPayment(1, new Date(), {
        rentPaid: 100,
        rentBankTransferPaid: 50,
        rentCashbox1Paid: 40,
        rentCashbox2Paid: 5,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.addPayment(1, new Date(), {
        rentPaid: 100,
        rentBankTransferPaid: 50,
        rentCashbox1Paid: 40,
        rentCashbox2Paid: 5,
      }),
    ).rejects.toThrow('Rent amount must equal selected payment channels total');
  });

  it('throws when any payment amount is negative', async () => {
    const prisma = makePrismaMock();
    const service = new PaymentsService(prisma as any);

    await expect(
      service.addPayment(1, new Date(), {
        rentPaid: -1,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.addPayment(1, new Date(), {
        rentPaid: -1,
      }),
    ).rejects.toThrow('Payment amounts must be non-negative');
  });

  it('rejects payment for PREPAID pavilion outside prepaid month', async () => {
    const prisma = makePrismaMock();
    const service = new PaymentsService(prisma as any);

    const prepaidMonth = new Date();
    prepaidMonth.setDate(1);
    prepaidMonth.setHours(0, 0, 0, 0);

    prisma.pavilion.findUnique.mockResolvedValue({
      id: 10,
      status: PavilionStatus.PREPAID,
      prepaidUntil: prepaidMonth,
    });

    const otherMonth = new Date(
      prepaidMonth.getFullYear(),
      prepaidMonth.getMonth() - 1,
      1,
    );

    await expect(
      service.addPayment(10, otherMonth, {
        rentPaid: 100,
      }),
    ).rejects.toThrow(
      'For PREPAID pavilion, payment is allowed only for the first prepaid month',
    );
  });

  it('rejects utilities/advertising payments for PREPAID pavilion', async () => {
    const prisma = makePrismaMock();
    const service = new PaymentsService(prisma as any);

    const prepaidMonth = new Date();
    prepaidMonth.setDate(1);
    prepaidMonth.setHours(0, 0, 0, 0);

    prisma.pavilion.findUnique.mockResolvedValue({
      id: 11,
      status: PavilionStatus.PREPAID,
      prepaidUntil: prepaidMonth,
    });

    await expect(
      service.addPayment(11, prepaidMonth, {
        rentPaid: 100,
        utilitiesPaid: 10,
      }),
    ).rejects.toThrow(
      'Utilities and advertising cannot be paid while pavilion status is PREPAID',
    );
  });

  it('getMonthlySummary counts channel-only legacy payment as paid', async () => {
    const prisma = makePrismaMock();
    const service = new PaymentsService(prisma as any);

    const now = new Date();
    const period = new Date(now.getFullYear(), now.getMonth(), 1);

    const pavilionPayload = {
      id: 100,
      status: PavilionStatus.RENTED,
      prepaidUntil: null,
      squareMeters: 10,
      pricePerSqM: 10,
      rentAmount: 100,
      utilitiesAmount: 0,
      advertisingAmount: 0,
      discounts: [],
      additionalCharges: [],
      payments: [
        {
          period,
          rentPaid: 0,
          utilitiesPaid: 0,
          advertisingPaid: 0,
          rentBankTransferPaid: 100,
          rentCashbox1Paid: 0,
          rentCashbox2Paid: 0,
          utilitiesBankTransferPaid: 0,
          utilitiesCashbox1Paid: 0,
          utilitiesCashbox2Paid: 0,
          advertisingBankTransferPaid: 0,
          advertisingCashbox1Paid: 0,
          advertisingCashbox2Paid: 0,
        },
      ],
    };

    prisma.pavilion.findUnique
      .mockResolvedValueOnce(pavilionPayload)
      .mockResolvedValueOnce(pavilionPayload);
    prisma.pavilionMonthlyLedger.findUnique
      .mockResolvedValueOnce(null) // existing ledger for period
      .mockResolvedValueOnce(null); // previous month ledger
    prisma.pavilionMonthlyLedger.upsert.mockImplementation(async (args: any) => ({
      ...args.create,
    }));

    const summary = await service.getMonthlySummary(100, period);

    expect(summary.paid.rent).toBe(100);
    expect(summary.paid.total).toBe(100);
    expect(summary.expected.total).toBe(100);
    expect(summary.balance).toBe(0);
  });
});

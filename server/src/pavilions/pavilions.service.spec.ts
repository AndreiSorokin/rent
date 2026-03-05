import { PavilionsService } from './pavilions.service';
import { PavilionStatus } from '@prisma/client';

describe('PavilionsService', () => {
  let service: PavilionsService;

  beforeEach(() => {
    service = new PavilionsService({} as any, { log: jest.fn() } as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('uses strict previous month for carry and ignores older ledgers', () => {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const enriched = (service as any).enrichPavilionPaymentStatus({
      status: PavilionStatus.RENTED,
      squareMeters: 10,
      pricePerSqM: 10,
      rentAmount: 100,
      utilitiesAmount: 0,
      advertisingAmount: 0,
      payments: [
        {
          period: currentMonth,
          rentPaid: 100,
          utilitiesPaid: 0,
          advertisingPaid: 0,
          rentBankTransferPaid: 0,
          rentCashbox1Paid: 0,
          rentCashbox2Paid: 0,
        },
      ],
      discounts: [],
      additionalCharges: [],
      monthlyLedgers: [
        // Must be ignored for current carry if previous month ledger is absent.
        { period: twoMonthsAgo, openingDebt: 0, closingDebt: 500 },
        // Current month opening from ledger chain is authoritative fallback.
        { period: currentMonth, openingDebt: 0, closingDebt: 0 },
      ],
    });

    expect(enriched.paymentCarryAdjustment).toBe(0);
    expect(enriched.paymentStatus).toBe('PAID');
  });

  it('treats channel-only current month payment as paid', () => {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const enriched = (service as any).enrichPavilionPaymentStatus({
      status: PavilionStatus.RENTED,
      squareMeters: 10,
      pricePerSqM: 10,
      rentAmount: 100,
      utilitiesAmount: 0,
      advertisingAmount: 0,
      payments: [
        {
          period: currentMonth,
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
      discounts: [],
      additionalCharges: [],
      monthlyLedgers: [],
    });

    expect(enriched.paymentPaidTotal).toBe(100);
    expect(enriched.paymentExpectedTotal).toBe(100);
    expect(enriched.paymentStatus).toBe('PAID');
  });
});

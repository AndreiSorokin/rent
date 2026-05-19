import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PavilionExpenseStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { StoreActivityService } from 'src/store-activity/store-activity.service';
import { addMonths, endOfMonth, startOfMonth } from 'date-fns';

const HOUSEHOLD_TYPE = 'HOUSEHOLD' as any;

@Injectable()
export class HouseholdExpenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeActivity: StoreActivityService,
  ) {}

  private async refreshLedgerChainFromPeriod(pavilionId: number, fromPeriod: Date) {
    const start = startOfMonth(fromPeriod);
    const current = startOfMonth(new Date());
    for (
      let cursor = start;
      cursor.getTime() <= current.getTime();
      cursor = startOfMonth(addMonths(cursor, 1))
    ) {
      await this.refreshMonthlyLedger(pavilionId, cursor);
    }
  }

  private async refreshMonthlyLedger(pavilionId: number, period: Date) {
    const normalizedPeriod = startOfMonth(period);
    const monthStart = startOfMonth(normalizedPeriod);
    const monthEnd = endOfMonth(normalizedPeriod);
    const pavilion = await this.prisma.pavilion.findUnique({
      where: { id: pavilionId },
      include: {
        discounts: true,
        payments: {
          where: { period: normalizedPeriod },
        },
        additionalCharges: {
          where: {
            createdAt: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
          include: {
            payments: {
              where: {
                paidAt: {
                  gte: monthStart,
                  lte: monthEnd,
                },
              },
            },
          },
        },
        pavilionExpenses: {
          where: {
            createdAt: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
        },
        householdExpenses: {
          where: {
            createdAt: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
        },
      },
    });

    if (!pavilion) return;

    const previousPeriod = startOfMonth(
      new Date(normalizedPeriod.getFullYear(), normalizedPeriod.getMonth() - 1, 1),
    );
    const previousLedger = await this.prisma.pavilionMonthlyLedger.findUnique({
      where: {
        pavilionId_period: {
          pavilionId,
          period: previousPeriod,
        },
      },
      select: { closingDebt: true },
    });
    const openingDebt = previousLedger?.closingDebt ?? 0;

    const baseRent = Number(
      pavilion.rentAmount ?? pavilion.squareMeters * pavilion.pricePerSqM,
    );
    const monthlyDiscount = pavilion.discounts.reduce((sum, discount) => {
      const discountStart = startOfMonth(discount.startsAt);
      const discountEnd = discount.endsAt ? endOfMonth(discount.endsAt) : null;
      const intersects =
        discountStart.getTime() <= monthEnd.getTime() &&
        (!discountEnd || discountEnd.getTime() >= monthStart.getTime());
      if (!intersects) return sum;
      return sum + Number(discount.amount ?? 0) * pavilion.squareMeters;
    }, 0);

    const expectedRent =
      pavilion.status === 'PREPAID'
        ? baseRent
        : pavilion.status === 'RENTED'
          ? Math.max(baseRent - monthlyDiscount, 0)
          : 0;
    const expectedUtilities =
      pavilion.status === 'RENTED' ? Number(pavilion.utilitiesAmount ?? 0) : 0;
    const expectedAdvertising =
      pavilion.status === 'RENTED' ? Number(pavilion.advertisingAmount ?? 0) : 0;
    const expectedAdditional =
      pavilion.status === 'RENTED'
        ? pavilion.additionalCharges.reduce((sum, charge) => sum + Number(charge.amount ?? 0), 0)
        : 0;
    const expectedManualExpenses = (pavilion.pavilionExpenses ?? []).reduce(
      (sum, expense) => sum + Number(expense.amount ?? 0),
      0,
    );
    const expectedHouseholdExpenses = (pavilion.householdExpenses ?? []).reduce(
      (sum, expense) => sum + Number(expense.amount ?? 0),
      0,
    );
    const expectedTotal =
      expectedRent +
      expectedUtilities +
      expectedAdvertising +
      expectedAdditional +
      expectedManualExpenses +
      expectedHouseholdExpenses;

    const actualBase = pavilion.payments.reduce((sum, payment) => {
      const rentRaw = Number(payment.rentPaid ?? 0);
      const rentChannels =
        Number(payment.rentBankTransferPaid ?? 0) +
        Number(payment.rentCashbox1Paid ?? 0) +
        Number(payment.rentCashbox2Paid ?? 0);
      const utilitiesRaw = Number(payment.utilitiesPaid ?? 0);
      const utilitiesChannels =
        Number(payment.utilitiesBankTransferPaid ?? 0) +
        Number(payment.utilitiesCashbox1Paid ?? 0) +
        Number(payment.utilitiesCashbox2Paid ?? 0);
      const advertisingRaw = Number(payment.advertisingPaid ?? 0);
      const advertisingChannels =
        Number(payment.advertisingBankTransferPaid ?? 0) +
        Number(payment.advertisingCashbox1Paid ?? 0) +
        Number(payment.advertisingCashbox2Paid ?? 0);

      const rent = rentRaw > 0 ? rentRaw : rentChannels;
      const utilities = utilitiesRaw > 0 ? utilitiesRaw : utilitiesChannels;
      const advertising = advertisingRaw > 0 ? advertisingRaw : advertisingChannels;
      return sum + rent + utilities + advertising;
    }, 0);
    const actualAdditional = pavilion.additionalCharges.reduce(
      (sum, charge) =>
        sum +
        charge.payments.reduce(
          (paymentSum, payment) => paymentSum + Number(payment.amountPaid ?? 0),
          0,
        ),
      0,
    );
    const actualManualExpenses = (pavilion.pavilionExpenses ?? []).reduce((sum, expense) => {
      if (String(expense.status) !== 'PAID') return sum;
      const paidByChannels =
        Number((expense as any).bankTransferPaid ?? 0) +
        Number((expense as any).cashbox1Paid ?? 0) +
        Number((expense as any).cashbox2Paid ?? 0);
      return sum + (paidByChannels > 0 ? paidByChannels : Number(expense.amount ?? 0));
    }, 0);
    const actualHouseholdExpenses = (pavilion.householdExpenses ?? []).reduce(
      (sum, expense) =>
        String((expense as any).status) === 'PAID'
          ? sum + Number(expense.amount ?? 0)
          : sum,
      0,
    );
    const actualTotal =
      actualBase + actualAdditional + actualManualExpenses + actualHouseholdExpenses;
    const monthDelta = expectedTotal - actualTotal;
    const closingDebt = openingDebt + monthDelta;

    await this.prisma.pavilionMonthlyLedger.upsert({
      where: {
        pavilionId_period: {
          pavilionId,
          period: normalizedPeriod,
        },
      },
      update: {
        expectedRent,
        expectedUtilities,
        expectedAdvertising,
        expectedAdditional,
        expectedTotal,
        actualTotal,
        openingDebt,
        monthDelta,
        closingDebt,
      },
      create: {
        pavilionId,
        period: normalizedPeriod,
        expectedRent,
        expectedUtilities,
        expectedAdvertising,
        expectedAdditional,
        expectedTotal,
        actualTotal,
        openingDebt,
        monthDelta,
        closingDebt,
      },
    });
  }

  private normalizePaymentMethod(
    paymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2',
  ) {
    if (!paymentMethod) return 'BANK_TRANSFER';
    if (
      paymentMethod !== 'BANK_TRANSFER' &&
      paymentMethod !== 'CASHBOX1' &&
      paymentMethod !== 'CASHBOX2'
    ) {
      return 'BANK_TRANSFER';
    }
    return paymentMethod;
  }

  private deriveSingleMethod(
    bankTransferPaid: number,
    cashbox1Paid: number,
    cashbox2Paid: number,
  ): 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2' | null {
    const bank = Number(bankTransferPaid ?? 0);
    const cash1 = Number(cashbox1Paid ?? 0);
    const cash2 = Number(cashbox2Paid ?? 0);

    const nonZeroChannels = [bank > 0, cash1 > 0, cash2 > 0].filter(Boolean).length;
    if (nonZeroChannels !== 1) return null;
    if (bank > 0) return 'BANK_TRANSFER';
    if (cash1 > 0) return 'CASHBOX1';
    if (cash2 > 0) return 'CASHBOX2';
    return null;
  }

  private async appendExpenseLedgerEntry(args: {
    storeId: number;
    sourceType: string;
    sourceId?: number | null;
    expenseType: any;
    note?: string | null;
    bankTransferPaid: number;
    cashbox1Paid: number;
    cashbox2Paid: number;
    occurredAt?: Date;
  }) {
    const bank = Number(args.bankTransferPaid ?? 0);
    const cash1 = Number(args.cashbox1Paid ?? 0);
    const cash2 = Number(args.cashbox2Paid ?? 0);
    if (Math.abs(bank) <= 0.009 && Math.abs(cash1) <= 0.009 && Math.abs(cash2) <= 0.009) {
      return;
    }

    await (this.prisma as any).storeExpenseLedger.create({
      data: {
        storeId: args.storeId,
        sourceType: args.sourceType,
        sourceId: args.sourceId ?? null,
        expenseType: args.expenseType,
        note: args.note ?? null,
        bankTransferPaid: bank,
        cashbox1Paid: cash1,
        cashbox2Paid: cash2,
        occurredAt: args.occurredAt ?? new Date(),
      },
    });
  }

  list(storeId: number) {
    return (this.prisma.pavilionExpense as any)
      .findMany({
        where: {
          storeId,
          type: HOUSEHOLD_TYPE,
        },
        orderBy: { createdAt: 'desc' },
      })
      .then((rows: any[]) =>
        rows.map((row) => ({
          id: row.id,
          name: row.note ?? 'Хозяйственный расход',
          amount: row.amount,
          status: row.status,
          paymentMethod: row.paymentMethod ?? null,
          bankTransferPaid: Number(row.bankTransferPaid ?? 0),
          cashbox1Paid: Number(row.cashbox1Paid ?? 0),
          cashbox2Paid: Number(row.cashbox2Paid ?? 0),
          storeId: row.storeId,
          pavilionId: row.pavilionId,
          createdAt: row.createdAt,
        })),
      );
  }

  async create(
    storeId: number,
    data: {
      name: string;
      amount: number;
      status?: PavilionExpenseStatus;
      paymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2';
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
      idempotencyKey?: string;
    },
    userId?: number,
  ) {
    const amount = Number(data.amount ?? 0);
    const bankTransferPaid = Number(data.bankTransferPaid ?? 0);
    const cashbox1Paid = Number(data.cashbox1Paid ?? 0);
    const cashbox2Paid = Number(data.cashbox2Paid ?? 0);

    if (
      Number.isNaN(amount) ||
      Number.isNaN(bankTransferPaid) ||
      Number.isNaN(cashbox1Paid) ||
      Number.isNaN(cashbox2Paid) ||
      amount < 0 ||
      bankTransferPaid < 0 ||
      cashbox1Paid < 0 ||
      cashbox2Paid < 0
    ) {
      throw new BadRequestException('Amounts must be non-negative');
    }

    const channelsTotal = bankTransferPaid + cashbox1Paid + cashbox2Paid;
    const status = data.status ?? PavilionExpenseStatus.UNPAID;
    if (channelsTotal > 0 && Math.abs(channelsTotal - amount) > 0.01) {
      throw new BadRequestException(
        'Expense amount must equal selected payment channels total',
      );
    }

    const effectiveStatus =
      channelsTotal > 0 ? PavilionExpenseStatus.PAID : status;

    const normalizedPaymentMethod =
      effectiveStatus === PavilionExpenseStatus.PAID
        ? channelsTotal > 0
          ? this.deriveSingleMethod(bankTransferPaid, cashbox1Paid, cashbox2Paid)
          : this.normalizePaymentMethod(data.paymentMethod)
        : null;

    const paidChannels =
      effectiveStatus === PavilionExpenseStatus.PAID
        ? channelsTotal > 0
          ? {
              bankTransferPaid,
              cashbox1Paid,
              cashbox2Paid,
            }
          : {
              bankTransferPaid:
                this.normalizePaymentMethod(data.paymentMethod) ===
                'BANK_TRANSFER'
                  ? amount
                  : 0,
              cashbox1Paid:
                this.normalizePaymentMethod(data.paymentMethod) === 'CASHBOX1'
                  ? amount
                  : 0,
              cashbox2Paid:
                this.normalizePaymentMethod(data.paymentMethod) === 'CASHBOX2'
                  ? amount
                  : 0,
            }
        : {
            bankTransferPaid: 0,
            cashbox1Paid: 0,
            cashbox2Paid: 0,
          };

    const idempotencyKey = data.idempotencyKey?.trim();
    if (idempotencyKey) {
      const existing = await (this.prisma as any).pavilionExpense.findFirst({
        where: {
          storeId,
          type: HOUSEHOLD_TYPE,
          idempotencyKey,
        },
      });
      if (existing) {
        return {
          id: existing.id,
          name: existing.note ?? 'РҐРѕР·СЏР№СЃС‚РІРµРЅРЅС‹Р№ СЂР°СЃС…РѕРґ',
          amount: existing.amount,
          status: existing.status,
          paymentMethod: existing.paymentMethod ?? null,
          bankTransferPaid: Number(existing.bankTransferPaid ?? 0),
          cashbox1Paid: Number(existing.cashbox1Paid ?? 0),
          cashbox2Paid: Number(existing.cashbox2Paid ?? 0),
          storeId: existing.storeId,
          pavilionId: existing.pavilionId,
          createdAt: existing.createdAt,
        };
      }
    }

    return (this.prisma.pavilionExpense as any)
      .create({
        data: {
          storeId,
          type: HOUSEHOLD_TYPE,
          note: data.name,
          amount,
          status: effectiveStatus,
          paymentMethod: normalizedPaymentMethod,
          bankTransferPaid: paidChannels.bankTransferPaid,
          cashbox1Paid: paidChannels.cashbox1Paid,
          cashbox2Paid: paidChannels.cashbox2Paid,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
      })
      .then(async (row: any) => {
        if (row.status === PavilionExpenseStatus.PAID) {
          await this.appendExpenseLedgerEntry({
            storeId,
            sourceType: 'HOUSEHOLD_EXPENSE',
            sourceId: row.id,
            expenseType: row.type,
            note: row.note ?? null,
            bankTransferPaid: Number(row.bankTransferPaid ?? 0),
            cashbox1Paid: Number(row.cashbox1Paid ?? 0),
            cashbox2Paid: Number(row.cashbox2Paid ?? 0),
            occurredAt: row.createdAt,
          });
        }
        if (row.pavilionId) {
          await this.refreshLedgerChainFromPeriod(row.pavilionId, row.createdAt);
        }
        await this.storeActivity.log({
          storeId,
          userId,
          action: 'CREATE',
          entityType: 'HOUSEHOLD_EXPENSE',
          entityId: row.id,
          details: {
            name: row.note ?? 'Хозяйственный расход',
            amount: Number(row.amount ?? 0),
          },
        });
        return {
          id: row.id,
          name: row.note ?? 'Хозяйственный расход',
          amount: row.amount,
          status: row.status,
          paymentMethod: row.paymentMethod ?? null,
          bankTransferPaid: Number(row.bankTransferPaid ?? 0),
          cashbox1Paid: Number(row.cashbox1Paid ?? 0),
          cashbox2Paid: Number(row.cashbox2Paid ?? 0),
          storeId: row.storeId,
          pavilionId: row.pavilionId,
          createdAt: row.createdAt,
        };
      });
  }

  async delete(storeId: number, expenseId: number, userId?: number) {
    const expense = await (this.prisma.pavilionExpense as any).findFirst({
      where: {
        id: expenseId,
        storeId,
        type: HOUSEHOLD_TYPE,
      },
      select: { id: true, pavilionId: true, createdAt: true },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    const deleted = await this.prisma.pavilionExpense.delete({
      where: { id: expenseId },
    });
    if ((deleted as any).status === PavilionExpenseStatus.PAID) {
      await this.appendExpenseLedgerEntry({
        storeId,
        sourceType: 'HOUSEHOLD_EXPENSE',
        sourceId: deleted.id,
        expenseType: (deleted as any).type,
        note: (deleted as any).note ?? null,
        bankTransferPaid: -Number((deleted as any).bankTransferPaid ?? 0),
        cashbox1Paid: -Number((deleted as any).cashbox1Paid ?? 0),
        cashbox2Paid: -Number((deleted as any).cashbox2Paid ?? 0),
        occurredAt: deleted.createdAt,
      });
    }
    if ((deleted as any).pavilionId) {
      await this.refreshLedgerChainFromPeriod((deleted as any).pavilionId, deleted.createdAt);
    }
    await this.storeActivity.log({
      storeId,
      userId,
      action: 'DELETE',
      entityType: 'HOUSEHOLD_EXPENSE',
      entityId: deleted.id,
      details: {
        name: (deleted as any).note ?? 'Хозяйственный расход',
        amount: Number((deleted as any).amount ?? 0),
      },
    });
    return deleted;
  }

  async update(
    storeId: number,
    expenseId: number,
    data: {
      name?: string;
      amount?: number;
      status?: PavilionExpenseStatus;
      paymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2';
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    },
    userId?: number,
  ) {
    const expense = await (this.prisma.pavilionExpense as any).findFirst({
      where: {
        id: expenseId,
        storeId,
        type: HOUSEHOLD_TYPE,
      },
      select: {
        id: true,
        note: true,
        amount: true,
        status: true,
        paymentMethod: true,
        bankTransferPaid: true,
        cashbox1Paid: true,
        cashbox2Paid: true,
        pavilionId: true,
        createdAt: true,
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    const nextAmount =
      data.amount !== undefined ? Number(data.amount) : Number(expense.amount ?? 0);
    if (Number.isNaN(nextAmount) || nextAmount < 0) {
      throw new BadRequestException('Amount must be non-negative');
    }

    const nextStatus = (data.status ?? expense.status) as PavilionExpenseStatus;
    if (
      nextStatus !== PavilionExpenseStatus.PAID &&
      nextStatus !== PavilionExpenseStatus.UNPAID
    ) {
      throw new BadRequestException('Invalid status');
    }

    const updateData: any = {
      note: data.name !== undefined ? data.name : expense.note,
      amount: nextAmount,
      status: nextStatus,
    };

    if (nextStatus === PavilionExpenseStatus.UNPAID) {
      updateData.paymentMethod = null;
      updateData.bankTransferPaid = 0;
      updateData.cashbox1Paid = 0;
      updateData.cashbox2Paid = 0;
    } else {
      const hasAnyChannelsInput =
        data.bankTransferPaid !== undefined ||
        data.cashbox1Paid !== undefined ||
        data.cashbox2Paid !== undefined;

      let bank = hasAnyChannelsInput
        ? Number(data.bankTransferPaid ?? expense.bankTransferPaid ?? 0)
        : Number(expense.bankTransferPaid ?? 0);
      let cash1 = hasAnyChannelsInput
        ? Number(data.cashbox1Paid ?? expense.cashbox1Paid ?? 0)
        : Number(expense.cashbox1Paid ?? 0);
      let cash2 = hasAnyChannelsInput
        ? Number(data.cashbox2Paid ?? expense.cashbox2Paid ?? 0)
        : Number(expense.cashbox2Paid ?? 0);

      if (
        Number.isNaN(bank) ||
        Number.isNaN(cash1) ||
        Number.isNaN(cash2) ||
        bank < 0 ||
        cash1 < 0 ||
        cash2 < 0
      ) {
        throw new BadRequestException('Payment channels must be non-negative');
      }

      if (!hasAnyChannelsInput && bank + cash1 + cash2 <= 0) {
        const method = this.normalizePaymentMethod(
          data.paymentMethod ?? (expense.paymentMethod as any) ?? 'BANK_TRANSFER',
        );
        bank = method === 'BANK_TRANSFER' ? nextAmount : 0;
        cash1 = method === 'CASHBOX1' ? nextAmount : 0;
        cash2 = method === 'CASHBOX2' ? nextAmount : 0;
      }

      const channelsTotal = bank + cash1 + cash2;
      if (Math.abs(channelsTotal - nextAmount) > 0.01) {
        throw new BadRequestException(
          'Amount must equal selected payment channels total',
        );
      }

      updateData.bankTransferPaid = bank;
      updateData.cashbox1Paid = cash1;
      updateData.cashbox2Paid = cash2;
      updateData.paymentMethod = this.deriveSingleMethod(bank, cash1, cash2);
    }

    const updated = await (this.prisma.pavilionExpense as any).update({
      where: { id: expenseId },
      data: updateData,
    });
    const previousBank =
      expense.status === PavilionExpenseStatus.PAID ? Number(expense.bankTransferPaid ?? 0) : 0;
    const previousCash1 =
      expense.status === PavilionExpenseStatus.PAID ? Number(expense.cashbox1Paid ?? 0) : 0;
    const previousCash2 =
      expense.status === PavilionExpenseStatus.PAID ? Number(expense.cashbox2Paid ?? 0) : 0;
    const nextBank =
      updated.status === PavilionExpenseStatus.PAID ? Number(updated.bankTransferPaid ?? 0) : 0;
    const nextCash1 =
      updated.status === PavilionExpenseStatus.PAID ? Number(updated.cashbox1Paid ?? 0) : 0;
    const nextCash2 =
      updated.status === PavilionExpenseStatus.PAID ? Number(updated.cashbox2Paid ?? 0) : 0;

    await this.appendExpenseLedgerEntry({
      storeId,
      sourceType: 'HOUSEHOLD_EXPENSE',
      sourceId: updated.id,
      expenseType: updated.type,
      note: updated.note ?? null,
      bankTransferPaid: nextBank - previousBank,
      cashbox1Paid: nextCash1 - previousCash1,
      cashbox2Paid: nextCash2 - previousCash2,
      occurredAt: expense.createdAt,
    });
    if (expense.pavilionId) {
      await this.refreshLedgerChainFromPeriod(expense.pavilionId, expense.createdAt);
    }

    await this.storeActivity.log({
      storeId,
      userId,
      action: 'UPDATE',
      entityType: 'HOUSEHOLD_EXPENSE',
      entityId: updated.id,
      details: {
        name: updated.note ?? 'Хозяйственный расход',
        amount: Number(updated.amount ?? 0),
        status: updated.status,
      },
    });
    return updated;
  }

  async updateStatus(
    storeId: number,
    expenseId: number,
    status: PavilionExpenseStatus,
    paymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2',
    userId?: number,
  ) {
    const normalizedMethod = this.normalizePaymentMethod(paymentMethod);
    return this.update(storeId, expenseId, {
      status,
      paymentMethod: normalizedMethod,
    }, userId);
  }
}


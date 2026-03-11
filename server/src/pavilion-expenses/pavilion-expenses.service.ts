import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PavilionExpenseStatus, PavilionExpenseType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { StoreActivityService } from 'src/store-activity/store-activity.service';

@Injectable()
export class PavilionExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeActivity: StoreActivityService,
  ) {}

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
    return this.prisma.pavilionExpense.findMany({
      where: {
        OR: [{ storeId }, { pavilion: { storeId } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(
    storeId: number,
    data: {
      type: PavilionExpenseType;
      amount: number;
      note?: string | null;
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
          ? bankTransferPaid > 0 && cashbox1Paid === 0 && cashbox2Paid === 0
            ? 'BANK_TRANSFER'
            : cashbox1Paid > 0 && bankTransferPaid === 0 && cashbox2Paid === 0
              ? 'CASHBOX1'
              : cashbox2Paid > 0 && bankTransferPaid === 0 && cashbox1Paid === 0
                ? 'CASHBOX2'
                : null
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
                this.normalizePaymentMethod(data.paymentMethod) === 'BANK_TRANSFER'
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
      return (async () => {
        const existing = await (this.prisma.pavilionExpense as any).findFirst({
          where: {
            storeId,
            idempotencyKey,
          },
        });
        if (existing) return existing;

        const created = await (this.prisma.pavilionExpense as any).create({
          data: {
            storeId,
            type: data.type,
            amount,
            note: data.note ?? null,
            status: effectiveStatus,
            paymentMethod: normalizedPaymentMethod,
            bankTransferPaid: paidChannels.bankTransferPaid,
            cashbox1Paid: paidChannels.cashbox1Paid,
            cashbox2Paid: paidChannels.cashbox2Paid,
            idempotencyKey,
          },
        });
        await this.storeActivity.log({
          storeId,
          userId,
          action: 'CREATE',
          entityType: 'PAVILION_EXPENSE',
          entityId: created.id,
          details: {
            type: created.type,
            amount: Number(created.amount ?? 0),
            note: created.note ?? null,
            status: created.status,
          },
        });
        if (created.status === PavilionExpenseStatus.PAID) {
          await this.appendExpenseLedgerEntry({
            storeId,
            sourceType: 'PAVILION_EXPENSE',
            sourceId: created.id,
            expenseType: created.type,
            note: created.note ?? null,
            bankTransferPaid: Number(created.bankTransferPaid ?? 0),
            cashbox1Paid: Number(created.cashbox1Paid ?? 0),
            cashbox2Paid: Number(created.cashbox2Paid ?? 0),
            occurredAt: created.createdAt,
          });
        }
        return created;
      })();
    }

    return (this.prisma.pavilionExpense as any).create({
      data: {
        storeId,
        type: data.type,
        amount,
        note: data.note ?? null,
        status: effectiveStatus,
        paymentMethod: normalizedPaymentMethod,
        bankTransferPaid: paidChannels.bankTransferPaid,
        cashbox1Paid: paidChannels.cashbox1Paid,
        cashbox2Paid: paidChannels.cashbox2Paid,
      },
    }).then(async (created: any) => {
      if (created.status === PavilionExpenseStatus.PAID) {
        await this.appendExpenseLedgerEntry({
          storeId,
          sourceType: 'PAVILION_EXPENSE',
          sourceId: created.id,
          expenseType: created.type,
          note: created.note ?? null,
          bankTransferPaid: Number(created.bankTransferPaid ?? 0),
          cashbox1Paid: Number(created.cashbox1Paid ?? 0),
          cashbox2Paid: Number(created.cashbox2Paid ?? 0),
          occurredAt: created.createdAt,
        });
      }
      await this.storeActivity.log({
        storeId,
        userId,
        action: 'CREATE',
        entityType: 'PAVILION_EXPENSE',
        entityId: created.id,
        details: {
          type: created.type,
          amount: Number(created.amount ?? 0),
          note: created.note ?? null,
          status: created.status,
        },
      });
      return created;
    });
  }

  async updateStatus(
    storeId: number,
    expenseId: number,
    status: PavilionExpenseStatus,
    paymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2',
    userId?: number,
  ) {
    return this.update(storeId, expenseId, {
      status,
      paymentMethod: this.normalizePaymentMethod(paymentMethod),
    }, userId);
  }

  async update(
    storeId: number,
    expenseId: number,
    data: {
      type?: PavilionExpenseType;
      amount?: number;
      note?: string | null;
      status?: PavilionExpenseStatus;
      paymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2';
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    },
    userId?: number,
  ) {
    const expense = await this.prisma.pavilionExpense.findFirst({
      where: {
        id: expenseId,
        OR: [{ storeId }, { pavilion: { storeId } }],
      },
      select: {
        id: true,
        type: true,
        amount: true,
        note: true,
        status: true,
        paymentMethod: true,
        bankTransferPaid: true,
        cashbox1Paid: true,
        cashbox2Paid: true,
      },
    });

    if (!expense) {
      throw new NotFoundException('Pavilion expense not found');
    }

    const nextAmount =
      data.amount !== undefined ? Number(data.amount) : Number(expense.amount ?? 0);
    if (Number.isNaN(nextAmount) || nextAmount < 0) {
      throw new BadRequestException('Amounts must be non-negative');
    }

    const nextStatus = (data.status ?? expense.status) as PavilionExpenseStatus;
    if (
      nextStatus !== PavilionExpenseStatus.PAID &&
      nextStatus !== PavilionExpenseStatus.UNPAID
    ) {
      throw new BadRequestException('Invalid status');
    }

    const updateData: any = {
      amount: nextAmount,
      note: data.note !== undefined ? data.note : expense.note,
      status: nextStatus,
    };

    if (data.type !== undefined) {
      updateData.type = data.type;
    }

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
        throw new BadRequestException('Amounts must be non-negative');
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
          'Expense amount must equal selected payment channels total',
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
      sourceType: 'PAVILION_EXPENSE',
      sourceId: updated.id,
      expenseType: updated.type,
      note: updated.note ?? null,
      bankTransferPaid: nextBank - previousBank,
      cashbox1Paid: nextCash1 - previousCash1,
      cashbox2Paid: nextCash2 - previousCash2,
    });

    await this.storeActivity.log({
      storeId,
      userId,
      action: 'UPDATE',
      entityType: 'PAVILION_EXPENSE',
      entityId: updated.id,
      details: {
        type: updated.type,
        amount: Number(updated.amount ?? 0),
        note: updated.note ?? null,
        status: updated.status,
      },
    });
    return updated;
  }

  async delete(storeId: number, expenseId: number, userId?: number) {
    const expense = await this.prisma.pavilionExpense.findFirst({
      where: {
        id: expenseId,
        OR: [{ storeId }, { pavilion: { storeId } }],
      },
      select: { id: true },
    });

    if (!expense) {
      throw new NotFoundException('Pavilion expense not found');
    }

    const deleted = await this.prisma.pavilionExpense.delete({
      where: { id: expenseId },
    });
    if (deleted.status === PavilionExpenseStatus.PAID) {
      await this.appendExpenseLedgerEntry({
        storeId,
        sourceType: 'PAVILION_EXPENSE',
        sourceId: deleted.id,
        expenseType: deleted.type,
        note: deleted.note ?? null,
        bankTransferPaid: -Number(deleted.bankTransferPaid ?? 0),
        cashbox1Paid: -Number(deleted.cashbox1Paid ?? 0),
        cashbox2Paid: -Number(deleted.cashbox2Paid ?? 0),
      });
    }
    await this.storeActivity.log({
      storeId,
      userId,
      action: 'DELETE',
      entityType: 'PAVILION_EXPENSE',
      entityId: deleted.id,
      details: {
        type: deleted.type,
        amount: Number(deleted.amount ?? 0),
        note: deleted.note ?? null,
      },
    });
    return deleted;
  }
}

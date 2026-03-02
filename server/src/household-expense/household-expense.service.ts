import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PavilionExpenseStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

const HOUSEHOLD_TYPE = 'HOUSEHOLD' as any;

@Injectable()
export class HouseholdExpenseService {
  constructor(private readonly prisma: PrismaService) {}

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

  create(storeId: number, data: { name: string; amount: number }) {
    return (this.prisma.pavilionExpense as any)
      .create({
        data: {
          storeId,
          type: HOUSEHOLD_TYPE,
          note: data.name,
          amount: data.amount,
          status: PavilionExpenseStatus.UNPAID,
          paymentMethod: null,
          bankTransferPaid: 0,
          cashbox1Paid: 0,
          cashbox2Paid: 0,
        },
      })
      .then((row: any) => ({
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
      }));
  }

  async delete(storeId: number, expenseId: number) {
    const expense = await (this.prisma.pavilionExpense as any).findFirst({
      where: {
        id: expenseId,
        storeId,
        type: HOUSEHOLD_TYPE,
      },
      select: { id: true },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return this.prisma.pavilionExpense.delete({
      where: { id: expenseId },
    });
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

    return (this.prisma.pavilionExpense as any).update({
      where: { id: expenseId },
      data: updateData,
    });
  }

  async updateStatus(
    storeId: number,
    expenseId: number,
    status: PavilionExpenseStatus,
    paymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2',
  ) {
    const normalizedMethod = this.normalizePaymentMethod(paymentMethod);
    return this.update(storeId, expenseId, {
      status,
      paymentMethod: normalizedMethod,
    });
  }
}


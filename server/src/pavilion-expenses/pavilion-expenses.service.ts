import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PavilionExpenseStatus, PavilionExpenseType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PavilionExpensesService {
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
    },
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
    });
  }

  async updateStatus(
    storeId: number,
    expenseId: number,
    status: PavilionExpenseStatus,
    paymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2',
  ) {
    const expense = await this.prisma.pavilionExpense.findFirst({
      where: {
        id: expenseId,
        OR: [{ storeId }, { pavilion: { storeId } }],
      },
      select: { id: true, amount: true },
    });

    if (!expense) {
      throw new NotFoundException('Pavilion expense not found');
    }

    return (this.prisma.pavilionExpense as any).update({
      where: { id: expenseId },
      data: {
        status,
        paymentMethod:
          status === PavilionExpenseStatus.PAID
            ? this.normalizePaymentMethod(paymentMethod)
            : null,
        bankTransferPaid:
          status === PavilionExpenseStatus.PAID &&
          this.normalizePaymentMethod(paymentMethod) === 'BANK_TRANSFER'
            ? Number(expense.amount ?? 0)
            : 0,
        cashbox1Paid:
          status === PavilionExpenseStatus.PAID &&
          this.normalizePaymentMethod(paymentMethod) === 'CASHBOX1'
            ? Number(expense.amount ?? 0)
            : 0,
        cashbox2Paid:
          status === PavilionExpenseStatus.PAID &&
          this.normalizePaymentMethod(paymentMethod) === 'CASHBOX2'
            ? Number(expense.amount ?? 0)
            : 0,
      },
    });
  }

  async delete(storeId: number, expenseId: number) {
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

    return this.prisma.pavilionExpense.delete({
      where: { id: expenseId },
    });
  }
}

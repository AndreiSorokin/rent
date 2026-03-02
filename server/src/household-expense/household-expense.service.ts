import { Injectable, NotFoundException } from '@nestjs/common';
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

  async updateStatus(
    storeId: number,
    expenseId: number,
    status: PavilionExpenseStatus,
    paymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2',
  ) {
    const expense = await (this.prisma.pavilionExpense as any).findFirst({
      where: {
        id: expenseId,
        storeId,
        type: HOUSEHOLD_TYPE,
      },
      select: { id: true, amount: true },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    const normalizedMethod = this.normalizePaymentMethod(paymentMethod);
    const amount = Number(expense.amount ?? 0);

    return (this.prisma.pavilionExpense as any).update({
      where: { id: expenseId },
      data: {
        status,
        paymentMethod:
          status === PavilionExpenseStatus.PAID ? normalizedMethod : null,
        bankTransferPaid:
          status === PavilionExpenseStatus.PAID && normalizedMethod === 'BANK_TRANSFER'
            ? amount
            : 0,
        cashbox1Paid:
          status === PavilionExpenseStatus.PAID && normalizedMethod === 'CASHBOX1'
            ? amount
            : 0,
        cashbox2Paid:
          status === PavilionExpenseStatus.PAID && normalizedMethod === 'CASHBOX2'
            ? amount
            : 0,
      },
    });
  }
}


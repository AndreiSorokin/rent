import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PavilionExpenseStatus,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

const HOUSEHOLD_TYPE = 'HOUSEHOLD' as any;

@Injectable()
export class HouseholdExpenseService {
  constructor(private readonly prisma: PrismaService) {}

  list(storeId: number) {
    return this.prisma.pavilionExpense
      .findMany({
        where: {
          storeId,
          type: HOUSEHOLD_TYPE,
        },
        orderBy: { createdAt: 'desc' },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          name: row.note ?? 'Хозяйственный расход',
          amount: row.amount,
          status: row.status,
          storeId: row.storeId,
          pavilionId: row.pavilionId,
          createdAt: row.createdAt,
        })),
      );
  }

  create(storeId: number, data: { name: string; amount: number }) {
    return this.prisma.pavilionExpense
      .create({
        data: {
          storeId,
          type: HOUSEHOLD_TYPE,
          note: data.name,
          amount: data.amount,
          status: PavilionExpenseStatus.UNPAID,
        },
      })
      .then((row) => ({
        id: row.id,
        name: row.note ?? 'Хозяйственный расход',
        amount: row.amount,
        status: row.status,
        storeId: row.storeId,
        pavilionId: row.pavilionId,
        createdAt: row.createdAt,
      }));
  }

  async delete(storeId: number, expenseId: number) {
    const expense = await this.prisma.pavilionExpense.findFirst({
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
  ) {
    const expense = await this.prisma.pavilionExpense.findFirst({
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

    return this.prisma.pavilionExpense.update({
      where: { id: expenseId },
      data: { status },
    });
  }
}

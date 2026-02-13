import { Injectable, NotFoundException } from '@nestjs/common';
import { PavilionExpenseStatus, PavilionExpenseType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PavilionExpensesService {
  constructor(private readonly prisma: PrismaService) {}

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
    },
  ) {
    return this.prisma.pavilionExpense.create({
      data: {
        storeId,
        type: data.type,
        amount: data.amount,
        note: data.note ?? null,
        status: data.status ?? PavilionExpenseStatus.UNPAID,
      },
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
        OR: [{ storeId }, { pavilion: { storeId } }],
      },
      select: { id: true },
    });

    if (!expense) {
      throw new NotFoundException('Pavilion expense not found');
    }

    return this.prisma.pavilionExpense.update({
      where: { id: expenseId },
      data: { status },
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

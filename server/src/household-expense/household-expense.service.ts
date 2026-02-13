import { Injectable, NotFoundException } from '@nestjs/common';
import { PavilionExpenseStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class HouseholdExpenseService {
  constructor(private readonly prisma: PrismaService) {}

  list(storeId: number) {
    return this.prisma.householdExpense.findMany({
      where: {
        OR: [{ storeId }, { pavilion: { storeId } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(storeId: number, data: { name: string; amount: number }) {
    return this.prisma.householdExpense.create({
      data: {
        storeId,
        name: data.name,
        amount: data.amount,
      },
    });
  }

  async delete(storeId: number, expenseId: number) {
    const expense = await this.prisma.householdExpense.findFirst({
      where: {
        id: expenseId,
        OR: [{ storeId }, { pavilion: { storeId } }],
      },
      select: { id: true },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return this.prisma.householdExpense.delete({
      where: { id: expenseId },
    });
  }

  async updateStatus(
    storeId: number,
    expenseId: number,
    status: PavilionExpenseStatus,
  ) {
    const expense = await this.prisma.householdExpense.findFirst({
      where: {
        id: expenseId,
        OR: [{ storeId }, { pavilion: { storeId } }],
      },
      select: { id: true },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return this.prisma.householdExpense.update({
      where: { id: expenseId },
      data: { status },
    });
  }
}

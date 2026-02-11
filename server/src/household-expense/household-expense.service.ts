import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class HouseholdExpenseService {
  constructor(private readonly prisma: PrismaService) {}

  list(pavilionId: number) {
    return this.prisma.householdExpense.findMany({
      where: { pavilionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(pavilionId: number, data: { name: string; amount: number }) {
    return this.prisma.householdExpense.create({
      data: {
        pavilionId,
        name: data.name,
        amount: data.amount,
      },
    });
  }

  async delete(pavilionId: number, expenseId: number) {
    const expense = await this.prisma.householdExpense.findFirst({
      where: {
        id: expenseId,
        pavilionId,
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
}

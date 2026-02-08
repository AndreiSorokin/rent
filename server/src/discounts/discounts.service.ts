import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(pavilionId: number) {
    return this.prisma.pavilionDiscount.findMany({
      where: { pavilionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    pavilionId: number,
    data: { amount: number; startsAt: string; endsAt?: string; note?: string },
  ) {
    const startsAt = new Date(data.startsAt);
    const endsAt = data.endsAt ? new Date(data.endsAt) : null;

    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Invalid startsAt date');
    }

    if (endsAt && Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('Invalid endsAt date');
    }

    if (endsAt && endsAt < startsAt) {
      throw new BadRequestException('endsAt must be greater than or equal to startsAt');
    }

    const pavilion = await this.prisma.pavilion.findUnique({
      where: { id: pavilionId },
      select: { id: true },
    });

    if (!pavilion) {
      throw new NotFoundException('Pavilion not found');
    }

    return this.prisma.pavilionDiscount.create({
      data: {
        pavilionId,
        amount: data.amount,
        startsAt,
        endsAt,
        note: data.note,
      },
    });
  }

  async delete(pavilionId: number, discountId: number) {
    const discount = await this.prisma.pavilionDiscount.findFirst({
      where: {
        id: discountId,
        pavilionId,
      },
      select: { id: true },
    });

    if (!discount) {
      throw new NotFoundException('Discount not found');
    }

    return this.prisma.pavilionDiscount.delete({
      where: { id: discountId },
    });
  }
}

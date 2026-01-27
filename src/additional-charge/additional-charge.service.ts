import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AdditionalChargeService {
  constructor(private prisma: PrismaService) {}

  create(pavilionId: number, data: { name: string; amount: number }) {
    return this.prisma.additionalCharge.create({
      data: {
        name: data.name,
        amount: data.amount,
        pavilionId,
      },
    });
  }

  findAll(pavilionId: number) {
    return this.prisma.additionalCharge.findMany({
      where: { pavilionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(
    pavilionId: number,
    chargeId: number,
    data: { name?: string; amount?: number },
  ) {
    const charge = await this.prisma.additionalCharge.findFirst({
      where: { id: chargeId, pavilionId },
    });

    if (!charge) {
      throw new NotFoundException('Additional charge not found');
    }

    return this.prisma.additionalCharge.update({
      where: { id: chargeId },
      data,
    });
  }

  async delete(pavilionId: number, chargeId: number) {
    const charge = await this.prisma.additionalCharge.findFirst({
      where: { id: chargeId, pavilionId },
    });

    if (!charge) {
      throw new NotFoundException('Additional charge not found');
    }

    return this.prisma.additionalCharge.delete({
      where: { id: chargeId },
    });
  }
}

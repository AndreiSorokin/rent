import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AdditionalChargeService {
  constructor(private prisma: PrismaService) {}

  async deletePayment(
    pavilionId: number,
    additionalChargeId: number,
    paymentId: number,
  ) {
  // Ensure payment belongs to the charge, and charge belongs to the pavilion
  const payment = await this.prisma.additionalChargePayment.findFirst({
    where: {
      id: paymentId,
      additionalChargeId,
      additionalCharge: { pavilionId },
    },
  });

  if (!payment) {
    throw new NotFoundException('Payment not found');
  }

  return this.prisma.additionalChargePayment.delete({
    where: { id: paymentId },
  });
}


  async payCharge(additionalChargeId: number, amountPaid: number) {
    const charge = await this.prisma.additionalCharge.findUnique({
      where: { id: additionalChargeId },
    });

    if (!charge) {
      throw new NotFoundException('Additional charge not found');
    }

    return this.prisma.additionalChargePayment.create({
      data: {
        additionalChargeId,
        amountPaid,
      },
    });
  }

  async listPayments(additionalChargeId: number) {
    return this.prisma.additionalChargePayment.findMany({
      where: { additionalChargeId },
      orderBy: { paidAt: 'asc' },
    });
  }

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

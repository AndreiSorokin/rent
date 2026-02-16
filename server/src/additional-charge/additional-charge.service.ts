import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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


  async payCharge(
    additionalChargeId: number,
    amountPaid: number,
    channels?: {
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    },
  ) {
    const charge = await this.prisma.additionalCharge.findUnique({
      where: { id: additionalChargeId },
    });

    if (!charge) {
      throw new NotFoundException('Additional charge not found');
    }
    const bankTransferPaid = Number(channels?.bankTransferPaid ?? 0);
    const cashbox1Paid = Number(channels?.cashbox1Paid ?? 0);
    const cashbox2Paid = Number(channels?.cashbox2Paid ?? 0);
    const hasChannelsInput =
      channels?.bankTransferPaid !== undefined ||
      channels?.cashbox1Paid !== undefined ||
      channels?.cashbox2Paid !== undefined;
    const channelsTotal = bankTransferPaid + cashbox1Paid + cashbox2Paid;

    if (
      Number.isNaN(amountPaid) ||
      amountPaid <= 0 ||
      bankTransferPaid < 0 ||
      cashbox1Paid < 0 ||
      cashbox2Paid < 0
    ) {
      throw new BadRequestException('Payment amounts must be valid and non-negative');
    }

    if (hasChannelsInput && Math.abs(channelsTotal - amountPaid) > 0.01) {
      throw new BadRequestException(
        'Additional charge amount must equal selected payment channels total',
      );
    }

    return this.prisma.additionalChargePayment.create({
      data: {
        additionalChargeId,
        amountPaid,
        bankTransferPaid: hasChannelsInput ? bankTransferPaid : amountPaid,
        cashbox1Paid: hasChannelsInput ? cashbox1Paid : 0,
        cashbox2Paid: hasChannelsInput ? cashbox2Paid : 0,
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

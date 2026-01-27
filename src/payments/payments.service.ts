import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { startOfMonth } from 'date-fns';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  //Create/Update payment record for a month
  async addPayment(
    pavilionId: number,
    period: Date,
    data: { rentPaid?: number; utilitiesPaid?: number },
  ) {
    const normalizedPeriod = startOfMonth(period);

    const pavilion = await this.prisma.pavilion.findUnique({
      where: { id: pavilionId },
    });

    if (!pavilion) {
      throw new NotFoundException('Pavilion not found');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return this.prisma.payment.upsert({
      where: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        pavilionId_period: { pavilionId, period: normalizedPeriod },
      },
      update: {
        rentPaid: data.rentPaid,
        utilitiesPaid: data.utilitiesPaid,
      },
      create: {
        pavilionId,
        period: normalizedPeriod,
        rentPaid: data.rentPaid,
        utilitiesPaid: data.utilitiesPaid,
      },
    });
  }

  list(pavilionId: number) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return this.prisma.payment.findMany({
      where: { pavilionId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
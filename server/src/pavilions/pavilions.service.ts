import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PavilionStatus, Prisma } from '@prisma/client';
import { CreatePavilionDto } from './dto/create-pavilion.dto';
import { endOfMonth, startOfMonth } from 'date-fns';

@Injectable()
export class PavilionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(storeId: number, dto: CreatePavilionDto) {
    const calculatedRent = dto.squareMeters * dto.pricePerSqM;
    const isPrepaid = dto.status === PavilionStatus.PREPAID;
    const parsedPrepaidUntil = dto.prepaidUntil
      ? endOfMonth(new Date(dto.prepaidUntil))
      : endOfMonth(new Date());

    return this.prisma.pavilion.create({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: {
        ...dto,
        rentAmount: dto.rentAmount ?? calculatedRent,
        status: dto.status ?? PavilionStatus.AVAILABLE,
        prepaidUntil: isPrepaid ? parsedPrepaidUntil : null,
        store: { connect: { id: storeId } },
      },
    });
  }

  async findAll(storeId: number) {
    await this.syncExpiredPrepayments(storeId);

    return this.prisma.pavilion.findMany({
      where: { storeId },
      include: {
        additionalCharges: true,
        discounts: true,
        payments: true,
        contracts: true,
      },
    });
  }

async findOne(storeId: number, id: number) {
  await this.syncExpiredPrepayments(storeId);

  return this.prisma.pavilion.findFirst({
    where: { id, storeId },
    include: {
      additionalCharges: {
        orderBy: { createdAt: 'asc' },
        include: {
          payments: { orderBy: { paidAt: 'asc' } },
        },
      },
      discounts: { orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { period: 'asc' } },
    },
  });
}

  async update(
    storeId: number,
    pavilionId: number,
    data: Prisma.PavilionUpdateInput,
  ) {
    const pavilion = await this.prisma.pavilion.findFirst({
      where: { id: pavilionId, storeId },
    });

    if (!pavilion) {
      throw new NotFoundException('Pavilion not found in this store');
    }

    const extractNumber = (value: unknown): number | undefined => {
      if (typeof value === 'number') return value;
      if (
        typeof value === 'object' &&
        value !== null &&
        'set' in (value as Record<string, unknown>) &&
        typeof (value as { set?: unknown }).set === 'number'
      ) {
        return (value as { set: number }).set;
      }
      return undefined;
    };

    const nextSquareMeters = extractNumber(data.squareMeters);
    const nextPricePerSqM = extractNumber(data.pricePerSqM);
    const nextStatus =
      typeof data.status === 'string'
        ? data.status
        : data.status && typeof data.status === 'object' && 'set' in data.status
          ? (data.status.set as PavilionStatus)
          : undefined;
    const nextPrepaidUntil =
      typeof data.prepaidUntil === 'string'
        ? new Date(data.prepaidUntil)
        : data.prepaidUntil instanceof Date
        ? data.prepaidUntil
        : data.prepaidUntil &&
            typeof data.prepaidUntil === 'object' &&
            'set' in data.prepaidUntil &&
            (data.prepaidUntil.set instanceof Date ||
              data.prepaidUntil.set === null)
          ? data.prepaidUntil.set
          : undefined;
    const normalizedPrepaidUntil =
      nextPrepaidUntil instanceof Date && !Number.isNaN(nextPrepaidUntil.getTime())
        ? nextPrepaidUntil
        : undefined;

    if (nextSquareMeters !== undefined || nextPricePerSqM !== undefined) {
      const effectiveSquareMeters = nextSquareMeters ?? pavilion.squareMeters;
      const effectivePricePerSqM = nextPricePerSqM ?? pavilion.pricePerSqM;

      data.rentAmount = effectiveSquareMeters * effectivePricePerSqM;
    }

    if (nextStatus === PavilionStatus.PREPAID) {
      data.prepaidUntil = normalizedPrepaidUntil
        ? endOfMonth(normalizedPrepaidUntil)
        : endOfMonth(new Date());
    } else if (
      nextStatus === PavilionStatus.AVAILABLE ||
      nextStatus === PavilionStatus.RENTED
    ) {
      data.prepaidUntil = null;
    }

    return this.prisma.pavilion.update({
      where: { id: pavilionId },
      data,
    });
  }

  // async update(
  //   storeId: number,
  //   id: number,
  //   data: Partial<{
  //     number: string;
  //     squareMeters: number;
  //     pricePerSqM: number;
  //     status: PavilionStatus;
  //     tenantName: string | null;
  //     rentAmount: number | null;
  //     utilitiesAmount: number | null;
  //   }>,
  // ) {
  //   await this.ensureExists(storeId, id);

  //   return this.prisma.pavilion.update({
  //     where: { id },
  //     data,
  //   });
  // }

  async delete(storeId: number, id: number) {
    await this.ensureExists(storeId, id);

    return this.prisma.pavilion.delete({
      where: { id },
    });
  }

  private async ensureExists(storeId: number, id: number) {
    const exists = await this.prisma.pavilion.findFirst({
      where: { id, storeId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Pavilion not found');
    }
  }

  private async syncExpiredPrepayments(storeId: number) {
    await this.prisma.pavilion.updateMany({
      where: {
        storeId,
        status: PavilionStatus.PREPAID,
        prepaidUntil: {
          lt: startOfMonth(new Date()),
        },
      },
      data: {
        status: PavilionStatus.RENTED,
        prepaidUntil: null,
      },
    });
  }
}

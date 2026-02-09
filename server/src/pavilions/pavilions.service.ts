import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PavilionStatus, Prisma } from '@prisma/client';
import { CreatePavilionDto } from './dto/create-pavilion.dto';

@Injectable()
export class PavilionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(storeId: number, dto: CreatePavilionDto) {
    const calculatedRent = dto.squareMeters * dto.pricePerSqM;

    return this.prisma.pavilion.create({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: {
        ...dto,
        rentAmount: dto.rentAmount ?? calculatedRent,
        status: dto.status ?? PavilionStatus.AVAILABLE,
        store: { connect: { id: storeId } },
      },
    });
  }

  async findAll(storeId: number) {
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

    if (nextSquareMeters !== undefined || nextPricePerSqM !== undefined) {
      const effectiveSquareMeters = nextSquareMeters ?? pavilion.squareMeters;
      const effectivePricePerSqM = nextPricePerSqM ?? pavilion.pricePerSqM;

      data.rentAmount = effectiveSquareMeters * effectivePricePerSqM;
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
}

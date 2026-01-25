import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PavilionStatus, Prisma } from '@prisma/client';

@Injectable()
export class PavilionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(storeId: number, data: Prisma.PavilionCreateInput) {
    return this.prisma.pavilion.create({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: {
        ...data,
        store: { connect: { id: storeId } },
      },
    });
  }

  // async create(
  //   storeId: number,
  //   data: {
  //     number: string;
  //     squareMeters: number;
  //     pricePerSqM: number;
  //     status?: PavilionStatus;
  //   },
  // ) {
  //   return this.prisma.pavilion.create({
  //     data: {
  //       ...data,
  //       storeId,
  //     },
  //   });
  // }

  async findAll(storeId: number) {
    return this.prisma.pavilion.findMany({
      where: { storeId },
      include: {
        additionalCharges: true,
        payments: true,
        contracts: true,
      },
    });
  }

  async findOne(storeId: number, id: number) {
    const pavilion = await this.prisma.pavilion.findFirst({
      where: { id, storeId },
      include: {
        additionalCharges: true,
        payments: true,
        contracts: true,
      },
    });

    if (!pavilion) {
      throw new NotFoundException('Pavilion not found');
    }

    return pavilion;
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

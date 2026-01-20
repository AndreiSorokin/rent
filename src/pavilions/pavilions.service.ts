import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PavilionsService {
  constructor(private prisma: PrismaService) {}

  // Get all pavilions
  findAll() {
    return this.prisma.pavilion.findMany({
      include: {
        additionalCharges: true,
        contracts: true,
        payments: true,
      },
    });
  }

  // Get pavilion by ID
  findOne(id: number) {
    return this.prisma.pavilion.findUnique({
      where: { id },
      include: {
        additionalCharges: true,
        contracts: true,
        payments: true,
      },
    });
  }

  // Create pavilion
  create(data: Prisma.PavilionCreateInput) {
    return this.prisma.pavilion.create({ data });
  }

  // Update pavilion
  update(id: number, data: Prisma.PavilionUpdateInput) {
    return this.prisma.pavilion.update({
      where: { id },
      data,
    });
  }

  // Delete pavilion
  delete(id: number) {
    return this.prisma.pavilion.delete({ where: { id } });
  }
}

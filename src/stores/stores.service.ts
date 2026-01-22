import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Permission, Prisma } from '@prisma/client';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.StoreCreateInput, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({ data });
      await tx.storeUser.create({
        data: {
          storeId: store.id,
          userId,
          permissions: Object.values(Permission),
        },
      });
      return store;
    });
  }

  delete(id: number) {
    return this.prisma.store.delete({ where: { id } });
  }

  findAll() {
    return this.prisma.store.findMany({
      include: {
        storeUsers: {
          include: {
            user: true,
          },
        },
        pavilions: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.store.findUnique({
      where: { id },
      include: {
        storeUsers: {
          include: {
            user: true,
          },
        },
        pavilions: true,
      },
    });
  }
}

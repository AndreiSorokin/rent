import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  create(data: Prisma.StoreCreateInput) {
    return this.prisma.store.create({ data });
  }

  delete(id: number) {
    return this.prisma.store.delete({ where: { id } });
  }

  findAll() {
    return this.prisma.store.findMany({
      include: { users: true, pavilions: true },
    });
  }

  findOne(id: number) {
    return this.prisma.store.findUnique({
      where: { id },
      include: { users: true, pavilions: true },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

type LogPayload = {
  storeId: number;
  pavilionId?: number | null;
  userId?: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  details?: Prisma.InputJsonValue;
};

@Injectable()
export class StoreActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async log(payload: LogPayload) {
    try {
      await (this.prisma as any).storeActivity.create({
        data: {
          storeId: payload.storeId,
          pavilionId: payload.pavilionId ?? null,
          userId: payload.userId ?? null,
          action: payload.action,
          entityType: payload.entityType,
          entityId: payload.entityId ?? null,
          details: payload.details ?? Prisma.JsonNull,
        },
      });
    } catch {
      // Activity logging must never break core mutations.
    }
  }
}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { subYears } from 'date-fns';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class LeaseRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeaseRetentionService.name);
  private retentionTimer?: NodeJS.Timeout;
  private cleanupLastRunAt?: number;
  private readonly cleanupIntervalMs = 12 * 60 * 60 * 1000;
  private readonly retentionYears = 3;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.runCleanupJob();
    this.retentionTimer = setInterval(() => {
      void this.runCleanupJob();
    }, this.cleanupIntervalMs);
  }

  onModuleDestroy() {
    if (this.retentionTimer) {
      clearInterval(this.retentionTimer);
      this.retentionTimer = undefined;
    }
  }

  private removeUploadedFile(filePath?: string | null) {
    if (!filePath) return;
    try {
      const absolutePath = join(process.cwd(), filePath.replace(/^\/+/, ''));
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to delete expired contract file ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private getCutoffDateKey() {
    return subYears(new Date(), this.retentionYears).toISOString().slice(0, 10);
  }

  private async runCleanupJob() {
    const now = Date.now();
    if (this.cleanupLastRunAt && now - this.cleanupLastRunAt < this.cleanupIntervalMs) {
      return;
    }
    this.cleanupLastRunAt = now;

    const cutoffDateKey = this.getCutoffDateKey();
    const prismaAny = this.prisma as any;

    try {
      const expiredContracts = await prismaAny.contract.findMany({
        where: {
          pavilionLease: {
            status: {
              in: ['ENDED', 'CANCELLED'],
            },
            endsOn: {
              not: null,
              lt: cutoffDateKey,
            },
          },
        },
        select: {
          id: true,
          filePath: true,
        },
      });

      for (const contract of expiredContracts) {
        this.removeUploadedFile(contract.filePath);
      }

      if (expiredContracts.length > 0) {
        await prismaAny.contract.deleteMany({
          where: {
            id: {
              in: expiredContracts.map((contract: { id: number }) => contract.id),
            },
          },
        });
      }

      const deletedLeases = await prismaAny.pavilionLease.deleteMany({
        where: {
          status: {
            in: ['ENDED', 'CANCELLED'],
          },
          endsOn: {
            not: null,
            lt: cutoffDateKey,
          },
          contracts: {
            none: {},
          },
        },
      });

      if (expiredContracts.length > 0 || deletedLeases.count > 0) {
        this.logger.log(
          `Lease retention cleanup removed ${expiredContracts.length} expired contract(s) and ${deletedLeases.count} empty lease record(s).`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Lease retention cleanup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

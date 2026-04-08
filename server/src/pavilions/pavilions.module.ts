import { Module } from '@nestjs/common';
import { PavilionsService } from './pavilions.service';
import { PavilionsController } from './pavilions.controller';
import { LeaseRetentionService } from './lease-retention.service';

@Module({
  providers: [PavilionsService, LeaseRetentionService],
  controllers: [PavilionsController]
})
export class PavilionsModule {}

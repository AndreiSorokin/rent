import { Module } from '@nestjs/common';
import { AdditionalChargeService } from './additional-charge.service';
import { AdditionalChargeController } from './additional-charge.controller';

@Module({
  providers: [AdditionalChargeService],
  controllers: [AdditionalChargeController]
})
export class AdditionalChargeModule {}

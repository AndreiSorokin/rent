import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdditionalChargeService } from './additional-charge.service';
import { AdditionalChargeController } from './additional-charge.controller';

@Module({
  imports: [PrismaModule],
  providers: [AdditionalChargeService],
  controllers: [AdditionalChargeController],
})
export class AdditionalChargeModule {}

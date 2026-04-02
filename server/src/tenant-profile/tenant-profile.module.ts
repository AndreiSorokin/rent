import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantProfileController } from './tenant-profile.controller';
import { TenantProfileService } from './tenant-profile.service';

@Module({
  imports: [PrismaModule],
  controllers: [TenantProfileController],
  providers: [TenantProfileService],
})
export class TenantProfileModule {}

import { Module } from '@nestjs/common';
import { StoreUserService } from './store-user.service';
import { StoreUserController } from './store-user.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [StoreUserService],
  controllers: [StoreUserController],
})
export class StoreUserModule {}

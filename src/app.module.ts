import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { PavilionsModule } from './pavilions/pavilions.module';
import { StoresModule } from './stores/stores.module';
import { AuthModule } from './auth/auth.module';
import { StoreUserModule } from './store-user/store-user.module';
import { PaymentsModule } from './payments/payments.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdditionalChargeModule } from './additional-charge/additional-charge.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    PavilionsModule,
    StoresModule,
    AuthModule,
    PrismaModule,
    StoreUserModule,
    PaymentsModule,
    AnalyticsModule,
    AdditionalChargeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

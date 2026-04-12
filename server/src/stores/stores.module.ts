import { Module } from '@nestjs/common';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';
import { StoresBillingWebhookController } from './stores-billing-webhook.controller';

@Module({
  providers: [StoresService],
  controllers: [StoresController, StoresBillingWebhookController],
})
export class StoresModule {}

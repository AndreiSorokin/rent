import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { StoresService } from './stores.service';

@Controller('stores/billing/tbank')
export class StoresBillingWebhookController {
  constructor(private readonly service: StoresService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() payload: Record<string, unknown>) {
    await this.service.handleTBankWebhook(payload);
    return 'OK';
  }
}

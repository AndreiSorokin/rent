import { Global, Module } from '@nestjs/common';
import { StoreActivityService } from './store-activity.service';

@Global()
@Module({
  providers: [StoreActivityService],
  exports: [StoreActivityService],
})
export class StoreActivityModule {}

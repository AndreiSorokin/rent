import { Module } from '@nestjs/common';
import { PavilionsService } from './pavilions.service';
import { PavilionsController } from './pavilions.controller';

@Module({
  providers: [PavilionsService],
  controllers: [PavilionsController]
})
export class PavilionsModule {}

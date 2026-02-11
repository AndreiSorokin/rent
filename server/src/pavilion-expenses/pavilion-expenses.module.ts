import { Module } from '@nestjs/common';
import { PavilionExpensesController } from './pavilion-expenses.controller';
import { PavilionExpensesService } from './pavilion-expenses.service';

@Module({
  controllers: [PavilionExpensesController],
  providers: [PavilionExpensesService],
})
export class PavilionExpensesModule {}

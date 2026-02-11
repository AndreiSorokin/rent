import { Module } from '@nestjs/common';
import { HouseholdExpenseController } from './household-expense.controller';
import { HouseholdExpenseService } from './household-expense.service';

@Module({
  controllers: [HouseholdExpenseController],
  providers: [HouseholdExpenseService],
})
export class HouseholdExpenseModule {}

import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDiscountDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  startsAt: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

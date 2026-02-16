import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PavilionStatus } from '@prisma/client';

export class CreatePavilionDto {
  @IsString()
  number: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @Min(0)
  squareMeters: number;

  @IsNumber()
  @Min(0)
  pricePerSqM: number;

  @IsEnum(PavilionStatus)
  @IsOptional()
  status?: PavilionStatus;

  @IsString()
  @IsOptional()
  tenantName?: string;

  @IsNumber()
  @IsOptional()
  rentAmount?: number;

  @IsNumber()
  @IsOptional()
  utilitiesAmount?: number;

  @IsNumber()
  @IsOptional()
  advertisingAmount?: number;

  @IsDateString()
  @IsOptional()
  prepaidUntil?: string;
}

import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PavilionStatus } from '@prisma/client';

export class CreatePavilionDto {
  @IsString()
  number: string;

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
}

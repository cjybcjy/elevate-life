import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  name: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsNumber()
  balance?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  valuationMethod?: string;

  @IsOptional()
  @IsString()
  liquidityTier?: string;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  balance?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  valuationMethod?: string;

  @IsOptional()
  @IsString()
  liquidityTier?: string;
}

import { IsString, IsOptional, IsNumberString, MaxLength } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsNumberString()
  balance?: string;

  @IsOptional()
  @IsNumberString()
  quantity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  stockCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  valuationMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  liquidityTier?: string;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumberString()
  balance?: string;

  @IsOptional()
  @IsNumberString()
  quantity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  stockCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  valuationMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  liquidityTier?: string;
}

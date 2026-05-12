import { IsString, IsOptional, IsNumber, IsIn, IsDateString, IsNumberString, Min, Max, MaxLength } from 'class-validator';

export class CreateLiabilityDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(50)
  category: string;

  @IsNumberString()
  principal: string;

  @IsOptional()
  @IsNumberString()
  currentBalance?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  interestRate: number;

  @IsNumber()
  @Min(1)
  termMonths: number;

  @IsIn(['equal_interest', 'equal_principal'])
  paymentMethod: string;

  @IsDateString()
  startDate: Date;

  @IsOptional()
  @IsNumberString()
  monthlyPayment?: string;
}

export class UpdateLiabilityDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsNumberString()
  principal?: string;

  @IsOptional()
  @IsNumberString()
  currentBalance?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  interestRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  termMonths?: number;

  @IsOptional()
  @IsIn(['equal_interest', 'equal_principal'])
  paymentMethod?: string;

  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsNumberString()
  monthlyPayment?: string;
}

import { IsString, IsOptional, IsNumber, IsIn, IsDateString } from 'class-validator';

export class CreateLiabilityDto {
  @IsString()
  name: string;

  @IsString()
  category: string;

  @IsNumber()
  principal: number;

  @IsOptional()
  @IsNumber()
  currentBalance?: number;

  @IsNumber()
  interestRate: number;

  @IsNumber()
  termMonths: number;

  @IsIn(['equal_interest', 'equal_principal'])
  paymentMethod: string;

  @IsDateString()
  startDate: Date;

  @IsOptional()
  @IsNumber()
  monthlyPayment?: number;
}

export class UpdateLiabilityDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  principal?: number;

  @IsOptional()
  @IsNumber()
  currentBalance?: number;

  @IsOptional()
  @IsNumber()
  interestRate?: number;

  @IsOptional()
  @IsNumber()
  termMonths?: number;

  @IsOptional()
  @IsIn(['equal_interest', 'equal_principal'])
  paymentMethod?: string;

  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsNumber()
  monthlyPayment?: number;
}

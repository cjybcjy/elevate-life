import { IsIn, IsOptional, IsNumber, IsString, IsDateString, IsUUID, Min, MaxLength } from 'class-validator';

export class CreateTransactionDto {
  @IsIn(['income', 'expense'])
  @MaxLength(10)
  type: 'income' | 'expense';

  @IsNumber()
  @Min(0)
  amount: number;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: Date;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsIn(['income', 'expense'])
  @MaxLength(10)
  type?: 'income' | 'expense';

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: Date;
}

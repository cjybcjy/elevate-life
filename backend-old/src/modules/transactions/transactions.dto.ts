import { IsIn, IsOptional, IsNumber, IsString, IsDateString, IsUUID, Min, MaxLength } from 'class-validator';

export class CreateTransactionDto {
  @IsIn(['income', 'expense', 'transfer'])
  @MaxLength(10)
  type: 'income' | 'expense' | 'transfer';

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: Date;

  @IsOptional()
  @IsUUID()
  fromAccountId?: string;

  @IsOptional()
  @IsUUID()
  toAccountId?: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsIn(['income', 'expense', 'transfer'])
  @MaxLength(10)
  type?: 'income' | 'expense' | 'transfer';

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

  @IsOptional()
  @IsUUID()
  fromAccountId?: string;

  @IsOptional()
  @IsUUID()
  toAccountId?: string;
}

import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('transactions')
@Index(['userId', 'occurredAt'])
export class Transaction extends BaseEntity {
  @Column({ length: 10 })
  type: 'income' | 'expense' | 'transfer';

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  categoryId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'date' })
  occurredAt: Date;

  @Column({ default: false })
  isEssential: boolean;

  @Column({ type: 'varchar', nullable: true })
  fromAccountId: string | null;

  @Column({ type: 'varchar', nullable: true })
  toAccountId: string | null;

  @Column()
  userId: string;
}

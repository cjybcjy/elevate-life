import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('transactions')
@Index(['userId', 'occurredAt'])
export class Transaction extends BaseEntity {
  @Column({ length: 10 }) type: 'income' | 'expense';
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount: number;
  @Column({ type: 'uuid' }) categoryId: string;
  @Column({ type: 'text', nullable: true }) description: string;
  @Column({ type: 'date' }) occurredAt: Date;
  @Column({ default: false }) isEssential: boolean;
  @Column({ type: 'uuid' }) userId: string;
}

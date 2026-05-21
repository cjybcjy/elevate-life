import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('debt_milestones')
@Index(['liabilityId', 'monthIndex'])
export class DebtMilestone extends BaseEntity {
  @Column({ type: 'uuid' }) liabilityId: string;
  @Column({ type: 'int' }) monthIndex: number;
  @Column({ type: 'date' }) dueDate: Date;
  @Column({ type: 'decimal', precision: 18, scale: 4 }) principalDue: number;
  @Column({ type: 'decimal', precision: 18, scale: 4 }) interestDue: number;
  @Column({ type: 'decimal', precision: 18, scale: 4 }) totalDue: number;
  @Column({ type: 'decimal', precision: 18, scale: 4 }) remainingBalance: number;
  @Column({ length: 20, default: 'base' }) scenarioType: string;
}

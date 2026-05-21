import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('liabilities')
export class Liability extends BaseEntity {
  @Column({ length: 200 }) name: string;
  @Column({ length: 50 }) category: string;
  @Column({ type: 'text', nullable: true }) principal: string;
  @Column({ type: 'text', nullable: true }) currentBalance: string;
  @Column({ type: 'decimal', precision: 6, scale: 4 }) interestRate: number;
  @Column({ type: 'int' }) termMonths: number;
  @Column({ type: 'date' }) startDate: Date;
  @Column({ length: 20 }) paymentMethod: string;
  @Column({ type: 'text', nullable: true }) monthlyPayment: string;
  @Column({ type: 'varchar', nullable: true })
  linkedAssetId: string | null;
  @Column({ default: false }) isEncrypted: boolean;
  @Column({ type: 'uuid' }) userId: string;
}

import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('assets')
@Index(['userId', 'category'])
export class Asset extends BaseEntity {
  @Column({ length: 200 }) name: string;
  @Column({ length: 50 }) category: string;
  @Column({ type: 'text', nullable: true }) balance: string;
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  quantity: number | null;
  @Column({ length: 20, nullable: true })
  stockCode: string | null;
  @Column({ length: 3, default: 'CNY' }) currency: string;
  @Column({ length: 50, nullable: true }) valuationMethod: string;
  @Column({ length: 20, nullable: true }) liquidityTier: string;
  @Column({ type: 'text', nullable: true })
  costBasis: string | null;
  @Column({ default: false }) isEncrypted: boolean;
  @Column({ type: 'uuid' }) userId: string;
}

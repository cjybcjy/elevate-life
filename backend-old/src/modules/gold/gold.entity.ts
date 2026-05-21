import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('price_history')
@Index(['assetType', 'recordedAt'])
export class GoldPrice extends BaseEntity {
  @Column({ length: 20, default: 'gold_au9999' })
  assetType: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  price: number;

  @Column({ length: 100, nullable: true })
  dataSource: string;

  @Column({ default: false })
  isInterpolated: boolean;

  @Column()
  recordedAt: Date;
}

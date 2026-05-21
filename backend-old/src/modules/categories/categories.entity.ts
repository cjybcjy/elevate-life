import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('categories')
export class Category extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 10 })
  type: 'income' | 'expense';

  @Column({ default: false })
  isEssential: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.00 })
  essentialRatio: number;

  @Column({ length: 50, nullable: true })
  icon: string;

  @Column({ length: 7, nullable: true })
  color: string;

  @Column({ type: 'uuid' })
  userId: string;
}

import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './categories.entity';
import { Transaction } from '../transactions/transactions.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private repo: Repository<Category>,
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
  ) {}

  async findByUser(userId: string): Promise<Category[]> {
    return this.repo.find({ where: { userId }, order: { type: 'ASC', name: 'ASC' } });
  }

  async create(userId: string, data: Partial<Category>): Promise<Category> {
    const category = this.repo.create({ ...data, userId });
    return this.repo.save(category);
  }

  async update(id: string, userId: string, data: Partial<Category>): Promise<Category> {
    await this.repo.update({ id, userId }, data);
    return this.repo.findOneOrFail({ where: { id, userId } });
  }

  async delete(id: string, userId: string): Promise<void> {
    const count = await this.txRepo.count({ where: { categoryId: id, userId } });
    if (count > 0) {
      throw new ConflictException(`该分类下存在 ${count} 笔交易，无法删除`);
    }
    await this.repo.delete({ id, userId });
  }
}

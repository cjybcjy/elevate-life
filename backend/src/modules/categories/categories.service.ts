import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './categories.entity';

@Injectable()
export class CategoriesService {
  constructor(@InjectRepository(Category) private repo: Repository<Category>) {}

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
    await this.repo.delete({ id, userId });
  }
}

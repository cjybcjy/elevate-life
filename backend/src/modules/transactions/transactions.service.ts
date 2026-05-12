import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Transaction } from './transactions.entity';

@Injectable()
export class TransactionsService {
  constructor(@InjectRepository(Transaction) private repo: Repository<Transaction>) {}

  async findByUser(userId: string, startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    const where: any = { userId };
    if (startDate && endDate) where.occurredAt = Between(startDate, endDate);
    return this.repo.find({ where, order: { occurredAt: 'DESC' } });
  }

  async getMonthlySummary(userId: string, year: number, month: number): Promise<any> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const transactions = await this.findByUser(userId, start, end);
    let income = 0, expense = 0, essentialExpense = 0;
    for (const t of transactions) {
      if (t.type === 'income') income += +t.amount;
      else { expense += +t.amount; if (t.isEssential) essentialExpense += +t.amount; }
    }
    return { year, month, income, expense, essentialExpense, surplus: income - expense };
  }

  async create(userId: string, data: any): Promise<Transaction> {
    const saved = await this.repo.save(this.repo.create({ ...data, userId }));
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async update(id: string, userId: string, data: any): Promise<Transaction> {
    await this.repo.update({ id, userId }, data);
    return this.repo.findOneOrFail({ where: { id, userId } });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.repo.delete({ id, userId });
  }
}

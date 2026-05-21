import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Transaction } from './transactions.entity';
import { AssetsService } from '../assets/assets.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction) private repo: Repository<Transaction>,
    private assetsService: AssetsService,
  ) {}

  async findByUser(userId: string, startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    const where: any = { userId };
    if (startDate && endDate) where.occurredAt = Between(startDate, endDate);
    return this.repo.find({ where, order: { occurredAt: 'DESC' } });
  }

  async findById(id: string, userId: string): Promise<Transaction | null> {
    return this.repo.findOne({ where: { id, userId } });
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
    const transaction = Array.isArray(saved) ? saved[0] : saved;

    try {
      if (data.type === 'expense' && data.fromAccountId) {
        await this.assetsService.adjustBalance(data.fromAccountId, userId, -data.amount);
      } else if (data.type === 'income' && data.toAccountId) {
        await this.assetsService.adjustBalance(data.toAccountId, userId, +data.amount);
      } else if (data.type === 'transfer' && data.fromAccountId && data.toAccountId) {
        await this.assetsService.adjustBalance(data.fromAccountId, userId, -data.amount);
        await this.assetsService.adjustBalance(data.toAccountId, userId, +data.amount);
      }
    } catch (err) {
      console.error('Failed to update asset balance after transaction:', err);
    }

    return transaction;
  }

  async update(id: string, userId: string, data: any): Promise<Transaction> {
    const old = await this.repo.findOne({ where: { id, userId } });

    await this.repo.update({ id, userId }, data);
    const updated = await this.repo.findOneOrFail({ where: { id, userId } });

    if (old) {
      try {
        if (old.type === 'expense' && old.fromAccountId) {
          await this.assetsService.adjustBalance(old.fromAccountId, userId, +old.amount);
        } else if (old.type === 'income' && old.toAccountId) {
          await this.assetsService.adjustBalance(old.toAccountId, userId, -old.amount);
        } else if (old.type === 'transfer' && old.fromAccountId && old.toAccountId) {
          await this.assetsService.adjustBalance(old.fromAccountId, userId, +old.amount);
          await this.assetsService.adjustBalance(old.toAccountId, userId, -old.amount);
        }
      } catch (err) {
        console.error('Failed to rollback old transaction balance:', err);
      }
    }

    try {
      const newType = data.type || old?.type;
      const newAmount = data.amount !== undefined ? data.amount : old?.amount;
      const newFrom = data.fromAccountId !== undefined ? data.fromAccountId : old?.fromAccountId;
      const newTo = data.toAccountId !== undefined ? data.toAccountId : old?.toAccountId;

      if (newType === 'expense' && newFrom) {
        await this.assetsService.adjustBalance(newFrom, userId, -newAmount);
      } else if (newType === 'income' && newTo) {
        await this.assetsService.adjustBalance(newTo, userId, +newAmount);
      } else if (newType === 'transfer' && newFrom && newTo) {
        await this.assetsService.adjustBalance(newFrom, userId, -newAmount);
        await this.assetsService.adjustBalance(newTo, userId, +newAmount);
      }
    } catch (err) {
      console.error('Failed to apply new transaction balance:', err);
    }

    return updated;
  }

  async delete(id: string, userId: string): Promise<void> {
    const transaction = await this.repo.findOne({ where: { id, userId } });
    if (!transaction) return;

    await this.repo.delete({ id, userId });

    try {
      if (transaction.type === 'expense' && transaction.fromAccountId) {
        await this.assetsService.adjustBalance(transaction.fromAccountId, userId, +transaction.amount);
      } else if (transaction.type === 'income' && transaction.toAccountId) {
        await this.assetsService.adjustBalance(transaction.toAccountId, userId, -transaction.amount);
      } else if (transaction.type === 'transfer' && transaction.fromAccountId && transaction.toAccountId) {
        await this.assetsService.adjustBalance(transaction.fromAccountId, userId, +transaction.amount);
        await this.assetsService.adjustBalance(transaction.toAccountId, userId, -transaction.amount);
      }
    } catch (err) {
      console.error('Failed to rollback asset balance after transaction deletion:', err);
    }
  }
}

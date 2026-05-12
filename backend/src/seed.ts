import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';
import { CategoriesService } from './modules/categories/categories.service';
import { AssetsService } from './modules/assets/assets.service';
import { LiabilitiesService } from './modules/liabilities/liabilities.service';
import { TransactionsService } from './modules/transactions/transactions.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersService = app.get(UsersService);
  const categoriesService = app.get(CategoriesService);
  const assetsService = app.get(AssetsService);
  const liabilitiesService = app.get(LiabilitiesService);
  const transactionsService = app.get(TransactionsService);

  try {
    console.log('[Seed] Checking for existing demo user...');
    let user = await usersService.findByUsername('demo');
    if (!user) {
      console.log('[Seed] Creating demo user...');
      const passwordHash = await require('bcrypt').hash('demo123', 12);
      user = await usersService.create('demo', passwordHash, '演示用户');
      console.log(`[Seed] Demo user created: ${user.id}`);
    } else {
      console.log(`[Seed] Demo user already exists: ${user.id}`);
    }

    const userId = user.id;

    console.log('[Seed] Creating categories...');
    const categoryData = [
      { name: '工资收入', type: 'income' as const, icon: '💰' },
      { name: '生活支出', type: 'expense' as const, icon: '🛒' },
      { name: '投资收益', type: 'income' as const, icon: '📈' },
      { name: '房贷支出', type: 'expense' as const, icon: '🏠' },
    ];
    const categories: Record<string, any> = {};
    for (const data of categoryData) {
      const existing = (await categoriesService.findByUser(userId)).find((c) => c.name === data.name);
      if (existing) {
        console.log(`[Seed] Category "${data.name}" already exists`);
        categories[data.name] = existing;
      } else {
        const cat = await categoriesService.create(userId, data);
        console.log(`[Seed] Category "${data.name}" created: ${cat.id}`);
        categories[data.name] = cat;
      }
    }

    console.log('[Seed] Creating assets...');
    const assetData = [
      { name: '自住房产', category: 'real_estate', balance: 2000000, initialValue: 1800000 },
      { name: '现金存款', category: 'cash', balance: 900000, initialValue: 900000 },
      { name: '黄金积存', category: 'gold', balance: 680000, initialValue: 600000 },
      { name: '股票账户', category: 'stock', balance: 500000, initialValue: 450000 },
    ];
    for (const data of assetData) {
      const existing = (await assetsService.findByUser(userId)).find((a) => a.name === data.name);
      if (existing) {
        console.log(`[Seed] Asset "${data.name}" already exists`);
      } else {
        const asset = await assetsService.create(userId, data);
        console.log(`[Seed] Asset "${data.name}" created: ${asset.id}`);
      }
    }

    console.log('[Seed] Creating liabilities...');
    const liabilityData = [
      {
        name: '住房贷款',
        category: 'mortgage',
        principal: 1000000,
        currentBalance: 850000,
        interestRate: 0.041,
        termMonths: 360,
        paymentMethod: 'equal_interest',
        startDate: new Date('2020-01-01'),
      },
      {
        name: '汽车贷款',
        category: 'car_loan',
        principal: 150000,
        currentBalance: 80000,
        interestRate: 0.052,
        termMonths: 60,
        paymentMethod: 'equal_principal',
        startDate: new Date('2023-01-01'),
      },
      {
        name: '信用贷款',
        category: 'personal',
        principal: 50000,
        currentBalance: 35000,
        interestRate: 0.078,
        termMonths: 36,
        paymentMethod: 'equal_interest',
        startDate: new Date('2024-01-01'),
      },
    ];
    for (const data of liabilityData) {
      const existing = (await liabilitiesService.findByUser(userId)).find((l) => l.name === data.name);
      if (existing) {
        console.log(`[Seed] Liability "${data.name}" already exists`);
      } else {
        const liability = await liabilitiesService.create(userId, data);
        console.log(`[Seed] Liability "${data.name}" created: ${liability.id}`);
      }
    }

    console.log('[Seed] Creating transactions...');
    const now = new Date();
    const transactionData = [
      {
        type: 'income' as const,
        amount: 30000,
        categoryId: categories['工资收入'].id,
        description: '月工资',
        occurredAt: new Date(now.getFullYear(), now.getMonth(), 5),
      },
      {
        type: 'expense' as const,
        amount: 20000,
        categoryId: categories['生活支出'].id,
        description: '本月生活支出',
        occurredAt: new Date(now.getFullYear(), now.getMonth(), 10),
      },
    ];
    for (const data of transactionData) {
      const tx = await transactionsService.create(userId, data);
      console.log(`[Seed] Transaction "${data.description}" created: ${tx.id}`);
    }

    console.log('[Seed] Done.');
  } catch (error) {
    console.error('[Seed] Error:', error);
    await app.close();
    process.exit(1);
  }
  await app.close();
}

bootstrap().catch((err) => {
  console.error('[Seed] Bootstrap error:', err);
  process.exit(1);
});

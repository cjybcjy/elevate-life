import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcrypt';

async function main() {
  const passwordHash = await bcrypt.hash('demo123', 12);

  const user = await prisma.user.upsert({
    where: { username: 'demo' },
    update: {},
    create: {
      username: 'demo',
      passwordHash,
      displayName: 'Demo User',
    },
  });

  // Clean up existing demo data
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.debtMilestone.deleteMany({
    where: { liability: { userId: user.id } },
  });
  await prisma.liability.deleteMany({ where: { userId: user.id } });
  await prisma.asset.deleteMany({ where: { userId: user.id } });
  await prisma.category.deleteMany({ where: { userId: user.id } });

  // Create categories
  const categories = await prisma.category.createMany({
    data: [
      { name: '工资', type: 'INCOME', icon: '💰', color: '#10b981', userId: user.id },
      { name: '餐饮', type: 'EXPENSE', icon: '🍔', color: '#ef4444', isEssential: true, userId: user.id },
      { name: '房租', type: 'EXPENSE', icon: '🏠', color: '#f59e0b', isEssential: true, userId: user.id },
      { name: '交通', type: 'EXPENSE', icon: '🚗', color: '#3b82f6', userId: user.id },
    ],
  });

  // Create assets (plain text balances for demo)
  const assets = await prisma.asset.createMany({
    data: [
      { name: '现金存款', category: 'CASH', balance: '100000.0000', currency: 'CNY', userId: user.id, isEncrypted: false },
      { name: '股票账户', category: 'STOCK', balance: '500000.0000', currency: 'CNY', costPrice: '450000.0000', userId: user.id, isEncrypted: false },
    ],
  });

  // Create a liability
  const liability = await prisma.liability.create({
    data: {
      name: '房贷',
      category: 'MORTGAGE',
      principal: '2000000.0000',
      currentBalance: '1800000.0000',
      interestRate: 0.039,
      termMonths: 360,
      startDate: new Date('2024-01-01'),
      paymentMethod: 'equal_interest',
      monthlyPayment: '9433.0000',
      userId: user.id,
      isEncrypted: false,
    },
  });

  console.log(`Seed completed: user=${user.id}, categories=${categories.count}, assets=${assets.count}, liability=${liability.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

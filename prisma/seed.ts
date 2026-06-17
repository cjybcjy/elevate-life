import { loadEnvConfig } from '@next/env';
import bcrypt from 'bcrypt';

loadEnvConfig(process.cwd());

const REVIEW_ACCOUNT_USERNAME = process.env.REVIEW_ACCOUNT_USERNAME || 'demo';
const REVIEW_ACCOUNT_PASSWORD = process.env.REVIEW_ACCOUNT_PASSWORD || 'demo123';
let prismaClient: Awaited<typeof import('../src/lib/prisma')>['prisma'] | undefined;

function monthRange(reference = new Date()) {
  const currentMonthStart = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const currentMonthEnd = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0, 23, 59, 59));
  return { currentMonthStart, currentMonthEnd };
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  prismaClient = prisma;

  const passwordHash = await bcrypt.hash(REVIEW_ACCOUNT_PASSWORD, 12);
  const { currentMonthStart, currentMonthEnd } = monthRange();

  const user = await prisma.user.upsert({
    where: { username: REVIEW_ACCOUNT_USERNAME },
    update: {
      passwordHash,
      displayName: 'Store Review 家庭样例',
    },
    create: {
      username: REVIEW_ACCOUNT_USERNAME,
      passwordHash,
      displayName: 'Store Review 家庭样例',
    },
  });

  // Clean up existing demo data
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.savingsGoal.deleteMany({ where: { userId: user.id } });
  await prisma.budget.deleteMany({ where: { userId: user.id } });
  await prisma.recurringRule.deleteMany({ where: { userId: user.id } });
  await prisma.categoryRule.deleteMany({ where: { userId: user.id } });
  await prisma.debtMilestone.deleteMany({
    where: { liability: { userId: user.id } },
  });
  await prisma.liability.deleteMany({ where: { userId: user.id } });
  await prisma.asset.deleteMany({ where: { userId: user.id } });
  await prisma.category.deleteMany({ where: { userId: user.id } });

  // Create categories
  const categories = await prisma.category.createMany({
    data: [
      { name: '工资', type: 'INCOME', icon: '薪', color: '#10b981', userId: user.id },
      { name: '理财收益', type: 'INCOME', icon: '收', color: '#14b8a6', userId: user.id },
      { name: '餐饮', type: 'EXPENSE', icon: '餐', color: '#ef4444', isEssential: true, userId: user.id },
      { name: '房租', type: 'EXPENSE', icon: '住', color: '#f59e0b', isEssential: true, userId: user.id },
      { name: '交通', type: 'EXPENSE', icon: '行', color: '#3b82f6', userId: user.id },
      { name: '医疗', type: 'EXPENSE', icon: '医', color: '#ef4444', userId: user.id },
      { name: '固定支出', type: 'EXPENSE', icon: '固', color: '#f59e0b', isEssential: true, userId: user.id },
      { name: '提升品质', type: 'EXPENSE', icon: '品', color: '#8b5cf6', userId: user.id },
      { name: '旅行', type: 'EXPENSE', icon: '旅', color: '#06b6d4', userId: user.id },
      { name: '人情往来', type: 'EXPENSE', icon: '礼', color: '#ec4899', userId: user.id },
    ],
  });
  const categoryList = await prisma.category.findMany({ where: { userId: user.id } });
  const categoryByName = new Map(categoryList.map((category) => [category.name, category.id]));

  // Create assets (plain text balances for demo)
  const assets = await prisma.asset.createMany({
    data: [
      { name: '招商银行卡', category: 'current_deposit', balance: '85600.0000', currency: 'CNY', liquidityTier: 'tier1', userId: user.id, isEncrypted: false },
      { name: '现金备用金', category: 'cash', balance: '18000.0000', currency: 'CNY', liquidityTier: 'tier1', userId: user.id, isEncrypted: false },
      { name: '货币基金', category: 'fund', balance: '52000.0000', currency: 'CNY', liquidityTier: 'tier1', userId: user.id, isEncrypted: false },
      { name: '黄金储备', category: 'gold_physical', balance: '26025.0000', currency: 'CNY', liquidityTier: 'tier2', quantity: 50, costUnitPrice: 480, costPrice: '24000.0000', userId: user.id, isEncrypted: false },
      { name: '贵州茅台', category: 'stock', balance: '260000.0000', currency: 'CNY', liquidityTier: 'tier2', quantity: 500, stockCode: '600519', market: 'cn', costUnitPrice: 480, costPrice: '240000.0000', userId: user.id, isEncrypted: false },
    ],
  });
  const assetList = await prisma.asset.findMany({ where: { userId: user.id } });
  const assetByName = new Map(assetList.map((asset) => [asset.name, asset.id]));

  // Seed market prices
  await prisma.marketPrice.upsert({
    where: { code_market: { code: 'AU9999', market: 'commodity' } },
    create: { code: 'AU9999', market: 'commodity', name: '黄金9999', price: 520.50, source: 'seed' },
    update: {},
  });
  await prisma.marketPrice.upsert({
    where: { code_market: { code: '600519', market: 'cn' } },
    create: { code: '600519', market: 'cn', name: '贵州茅台', price: 520.00, source: 'seed' },
    update: {},
  });

  // Create a liability
  const liability = await prisma.liability.create({
    data: {
      name: '房贷',
      category: 'mortgage',
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

  await prisma.budget.createMany({
    data: [
      {
        name: '餐饮预算',
        categoryId: categoryByName.get('餐饮'),
        amount: '5000.0000',
        startDate: currentMonthStart,
        endDate: currentMonthEnd,
        userId: user.id,
      },
      {
        name: '交通预算',
        categoryId: categoryByName.get('交通'),
        amount: '1600.0000',
        startDate: currentMonthStart,
        endDate: currentMonthEnd,
        userId: user.id,
      },
      {
        name: '固定支出预算',
        categoryId: categoryByName.get('固定支出'),
        amount: '9800.0000',
        startDate: currentMonthStart,
        endDate: currentMonthEnd,
        userId: user.id,
      },
    ],
  });
  const budgetList = await prisma.budget.findMany({ where: { userId: user.id } });
  const budgetByName = new Map(budgetList.map((budget) => [budget.name, budget.id]));

  await prisma.transaction.createMany({
    data: [
      {
        type: 'INCOME',
        amount: '32000.0000',
        categoryId: categoryByName.get('工资'),
        toAccountId: assetByName.get('招商银行卡'),
        description: '6月工资入账',
        occurredAt: daysAgo(12),
        userId: user.id,
      },
      {
        type: 'INCOME',
        amount: '680.0000',
        categoryId: categoryByName.get('理财收益'),
        toAccountId: assetByName.get('货币基金'),
        description: '货币基金收益',
        occurredAt: daysAgo(6),
        userId: user.id,
      },
      {
        type: 'EXPENSE',
        amount: '186.5000',
        categoryId: categoryByName.get('餐饮'),
        budgetId: budgetByName.get('餐饮预算'),
        fromAccountId: assetByName.get('招商银行卡'),
        description: '家庭晚餐',
        occurredAt: daysAgo(5),
        isEssential: true,
        userId: user.id,
      },
      {
        type: 'EXPENSE',
        amount: '420.0000',
        categoryId: categoryByName.get('交通'),
        budgetId: budgetByName.get('交通预算'),
        fromAccountId: assetByName.get('招商银行卡'),
        description: '通勤充值',
        occurredAt: daysAgo(4),
        userId: user.id,
      },
      {
        type: 'EXPENSE',
        amount: '9433.0000',
        categoryId: categoryByName.get('固定支出'),
        budgetId: budgetByName.get('固定支出预算'),
        fromAccountId: assetByName.get('招商银行卡'),
        liabilityId: liability.id,
        description: '房贷月供',
        occurredAt: daysAgo(3),
        isEssential: true,
        userId: user.id,
      },
      {
        type: 'TRANSFER',
        amount: '3000.0000',
        fromAccountId: assetByName.get('招商银行卡'),
        toAccountId: assetByName.get('现金备用金'),
        description: '补充家庭现金备用金',
        occurredAt: daysAgo(2),
        userId: user.id,
      },
      {
        type: 'EXPENSE',
        amount: '268.0000',
        categoryId: categoryByName.get('提升品质'),
        fromAccountId: null,
        description: '待补来源账户的家庭采购',
        occurredAt: daysAgo(1),
        userId: user.id,
      },
    ],
  });

  await prisma.savingsGoal.create({
    data: {
      name: '家庭应急金',
      targetAmount: '180000.0000',
      currentAmount: '103600.0000',
      assetId: assetByName.get('招商银行卡'),
      deadline: new Date(Date.UTC(new Date().getUTCFullYear(), 11, 31)),
      icon: '应',
      color: '#14b8a6',
      userId: user.id,
    },
  });

  console.log(`Seed completed: user=${user.id}, username=${REVIEW_ACCOUNT_USERNAME}, categories=${categories.count}, assets=${assets.count}, liability=${liability.id}, budgets=3, transactions=7`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaClient?.$disconnect();
  });

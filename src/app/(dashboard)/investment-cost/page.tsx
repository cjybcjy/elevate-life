export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import InvestmentCostCalculator, {
  type InvestmentCostLiability,
  type InvestmentCostSnapshot,
} from '@/components/widgets/InvestmentCostCalculator';
import { getAssets } from '@/lib/actions/assets';
import { getLiabilities } from '@/lib/actions/liabilities';
import { auth } from '@/lib/auth';
import {
  getContractMaturityDate,
  getRemainingContractMonths,
} from '@/lib/investment-cost';
import { prisma } from '@/lib/prisma';
import { getCachedForexRates } from '@/lib/services/price/sources/forex';

function safeNumber(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? '0'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default async function InvestmentCostPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const now = new Date();
  const asOfDate = formatLocalDate(now);
  const startOfWindow = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const [liabilityResult, assetResult, recentTransactions] = await Promise.all([
    getLiabilities(),
    getAssets(),
    prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        occurredAt: { gte: startOfWindow },
        type: { in: ['INCOME', 'EXPENSE', 'income', 'expense'] },
      },
      select: {
        type: true,
        amount: true,
        currency: true,
        occurredAt: true,
      },
    }),
  ]);

  if (
    (!liabilityResult.success && liabilityResult.error?.includes('会话密钥'))
    || (!assetResult.success && assetResult.error?.includes('会话密钥'))
  ) {
    redirect('/login');
  }

  const rates = getCachedForexRates().rates;
  const cnyRates: Record<string, number> = {
    CNY: 1,
    USD: rates.usdToCny,
    HKD: rates.hkdToCny,
    JPY: rates.jpyToCny,
  };
  const toCny = (amount: unknown, currency?: string | null) => (
    safeNumber(amount) * (cnyRates[currency || 'CNY'] || 1)
  );

  const activeMonths = new Set<string>();
  let income = 0;
  let expense = 0;
  for (const transaction of recentTransactions) {
    activeMonths.add(`${transaction.occurredAt.getFullYear()}-${transaction.occurredAt.getMonth()}`);
    const amount = toCny(transaction.amount.toString(), transaction.currency);
    if (transaction.type.toUpperCase() === 'INCOME') income += amount;
    if (transaction.type.toUpperCase() === 'EXPENSE') expense += amount;
  }
  const divisor = Math.max(1, activeMonths.size);

  const assets = assetResult.success ? (assetResult.data ?? []) : [];
  const stockPoolValue = assets
    .filter((asset) => asset.category === 'stock')
    .reduce((sum, asset) => sum + toCny(
      asset.balance,
      asset.priceCurrency || asset.currency,
    ), 0);
  const liquidCash = assets
    .filter((asset) => asset.category === 'cash' || asset.category === 'current_deposit')
    .reduce((sum, asset) => sum + toCny(asset.balance, asset.currency), 0);

  const liabilities: InvestmentCostLiability[] = (
    liabilityResult.success ? (liabilityResult.data ?? []) : []
  )
    .map((liability) => {
      const contractEndDate = getContractMaturityDate(
        liability.startDate,
        liability.termMonths,
      );
      return {
        id: liability.id,
        name: liability.name,
        balance: safeNumber(liability.currentBalance),
        annualRate: safeNumber(liability.interestRate),
        monthlyPayment: liability.monthlyPayment === null
          ? null
          : safeNumber(liability.monthlyPayment),
        termMonths: liability.termMonths,
        startDate: formatLocalDate(liability.startDate),
        contractEndDate,
        remainingMonths: getRemainingContractMonths(asOfDate, contractEndDate),
        paymentMethod: liability.paymentMethod,
      };
    })
    .filter((liability) => liability.balance > 0)
    .sort((a, b) => b.annualRate - a.annualRate || b.balance - a.balance);

  const dataWarnings = [
    !liabilityResult.success ? '负债数据暂时不可用，可手动输入试算。' : '',
    !assetResult.success ? '资产数据暂时不可用，储备金和股票池现值未计入。' : '',
  ].filter(Boolean);

  const snapshot: InvestmentCostSnapshot = {
    asOfDate,
    monthlyIncome: income / divisor,
    monthlyExpense: expense / divisor,
    cashflowActiveMonths: activeMonths.size,
    liquidCash,
    stockPoolValue,
    dataWarnings,
  };

  return <InvestmentCostCalculator liabilities={liabilities} snapshot={snapshot} />;
}

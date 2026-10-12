import { auth } from '@/lib/auth';
import { getAssets } from '@/lib/actions/assets';
import { getLiabilities } from '@/lib/actions/liabilities';
import { getTransactions } from '@/lib/actions/ledger';
import { getForecastSnapshot } from '@/lib/actions/forecast';
import { getBudgets, getBudgetProgress, getBudgetsForCategory } from '@/lib/actions/budget';
import { getCategories } from '@/lib/actions/categories';
import { getGoals } from '@/lib/actions/goals';
import { getRecurringRules } from '@/lib/actions/recurring';
import { getCurrentGoldPrice } from '@/lib/actions/gold';
import { getCachedForexRates } from '@/lib/services/price/sources/forex';
import { parseBudgetQuery } from './budget-query';

export const dynamic = 'force-dynamic';

const readers = {
  assets: getAssets,
  liabilities: getLiabilities,
  transactions: getTransactions,
  'budgets-list': getBudgets,
  categories: getCategories,
  goals: getGoals,
  'recurring-rules': getRecurringRules,
  'gold-price': getCurrentGoldPrice,
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return json({ success: false, error: 'Unauthorized' }, 401);

  const { resource } = await params;
  const query = new URL(request.url).searchParams;
  try {
    if (resource === 'forex-rates') {
      return json({ success: true, data: getCachedForexRates().rates });
    }
    if (resource === 'forecast') {
      const raw = query.get('months') ?? '12';
      const months = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isInteger(months) || months < 1 || months > 120) {
        return json({ success: false, error: 'Invalid months' }, 400);
      }
      return json(await getForecastSnapshot(months));
    }
    if (resource === 'budgets' || resource === 'budgets-for-category') {
      const budgetQuery = parseBudgetQuery(query, resource === 'budgets-for-category');
      if ('error' in budgetQuery) return json({ success: false, error: budgetQuery.error }, 400);
      return json(resource === 'budgets'
        ? await getBudgetProgress(budgetQuery.date)
        : await getBudgetsForCategory(budgetQuery.date, budgetQuery.categoryId));
    }
    if (!Object.hasOwn(readers, resource)) return json({ success: false, error: 'Not found' }, 404);
    return json(await readers[resource as keyof typeof readers]());
  } catch {
    return json({ success: false, error: '读取数据失败，请重试' }, 500);
  }
}

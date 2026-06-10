import useSWR from 'swr';
import { getBudgetProgress } from '@/lib/actions/budget';

export function useBudgets(date: string) {
  return useSWR(['budgets', date].join(':'), async () => {
    const res = await getBudgetProgress(date);
    if (!res.success) throw new Error(res.error || 'Failed to fetch budgets');
    return { data: res.data ?? [] };
  });
}

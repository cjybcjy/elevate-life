import { readData } from '@/lib/read-data';
import useSWR from 'swr';

export function useBudgets(date: string, enabled = true) {
  return useSWR(enabled ? ['budgets', date].join(':') : null, async () => {
    const res = await readData('budgets', { date });
    if (!res.success) throw new Error(res.error || 'Failed to fetch budgets');
    return { data: res.data ?? [] };
  });
}

import { readData } from '@/lib/read-data';
import useSWR from 'swr';

export function useTransactions(filters?: { type?: string; categoryId?: string; startDate?: string; endDate?: string }, enabled = true) {
  const key = ['transactions', filters].filter(Boolean).join(':');
  return useSWR(enabled ? key : null, async () => {
    const res = await readData('transactions');
    if (!res.success) throw new Error(res.error || 'Failed to fetch transactions');
    return { data: res.data ?? [] };
  });
}

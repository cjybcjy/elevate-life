import useSWR from 'swr';
import { getTransactions } from '@/lib/actions/ledger';

export function useTransactions(filters?: { type?: string; categoryId?: string; startDate?: string; endDate?: string }) {
  const key = ['transactions', filters].filter(Boolean).join(':');
  return useSWR(key, async () => {
    const res = await getTransactions();
    if (!res.success) throw new Error(res.error || 'Failed to fetch transactions');
    return { data: res.data ?? [] };
  });
}

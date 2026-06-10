import useSWR from 'swr';
import { getLiabilities } from '@/lib/actions/liabilities';

export function useLiabilities() {
  return useSWR('liabilities', async () => {
    const res = await getLiabilities();
    if (!res.success) throw new Error(res.error || 'Failed to fetch liabilities');
    return { data: res.data ?? [] };
  });
}

import { readData } from '@/lib/read-data';
import useSWR from 'swr';

export function useLiabilities(enabled = true) {
  return useSWR(enabled ? 'liabilities' : null, async () => {
    const res = await readData('liabilities');
    if (!res.success) throw new Error(res.error || 'Failed to fetch liabilities');
    return { data: res.data ?? [] };
  });
}

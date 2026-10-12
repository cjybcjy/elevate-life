import { readData } from '@/lib/read-data';
import useSWR from 'swr';

export function useAssets(enabled = true) {
  return useSWR(enabled ? 'assets' : null, async () => {
    const res = await readData('assets');
    if (!res.success) throw new Error(res.error || 'Failed to fetch assets');
    return { data: res.data ?? [], pricesStale: (res as any).pricesStale ?? false };
  });
}

import useSWR from 'swr';
import { getAssets } from '@/lib/actions/assets';

export function useAssets() {
  return useSWR('assets', async () => {
    const res = await getAssets();
    if (!res.success) throw new Error(res.error || 'Failed to fetch assets');
    return { data: res.data ?? [], pricesStale: (res as any).pricesStale ?? false };
  });
}

import { readData } from '@/lib/read-data';
import useSWR from 'swr';

export function useForecast(months: number = 12, enabled = true) {
  return useSWR(enabled ? ['forecast', months].join(':') : null, async () => {
    const result = await readData('forecast', { months });
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch forecast');
    }
    return result.data;
  });
}

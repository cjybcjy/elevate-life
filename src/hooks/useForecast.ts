import useSWR from 'swr';
import { getForecastSnapshot } from '@/lib/actions/forecast';

export function useForecast(months: number = 12) {
  return useSWR(['forecast', months].join(':'), async () => {
    const result = await getForecastSnapshot(months);
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch forecast');
    }
    return result.data;
  });
}

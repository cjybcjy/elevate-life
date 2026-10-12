import { useAssets } from './useAssets';
import { useLiabilities } from './useLiabilities';
import { useTransactions } from './useTransactions';
import { useForecast } from './useForecast';
import { readData } from '@/lib/read-data';
import useSWR from 'swr';

export function useDashboard() {
  const assets = useAssets();
  const liabilities = useLiabilities();
  const transactions = useTransactions();
  const forecast = useForecast();
  const forex = useSWR('forex-rates', async () => {
    const result = await readData('forex-rates');
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch exchange rates');
    }
    return result.data;
  });

  const isLoading =
    assets.isLoading || liabilities.isLoading || transactions.isLoading || forex.isLoading;

  return {
    assets: assets.data?.data ?? [],
    liabilities: liabilities.data?.data ?? [],
    transactions: transactions.data?.data ?? [],
    forecast: forecast.data?.forecast ?? { months: [], warningLevel: 'green' },
    autoForecast: forecast.data?.autoForecast ?? {
      monthlyIncome: '20000', monthlyExpense: '15000', activeMonths: 0, recurringExpenses: [],
    },
    forexRates: forex.data,
    forecastIsLoading: forecast.data === undefined && !forecast.error,
    forecastError: forecast.data === undefined ? forecast.error : undefined,
    pricesStale: assets.data?.pricesStale ?? false,
    isLoading,
    error: (!assets.data && assets.error) || (!liabilities.data && liabilities.error)
      || (!transactions.data && transactions.error) || (!forex.data && forex.error),
  };
}

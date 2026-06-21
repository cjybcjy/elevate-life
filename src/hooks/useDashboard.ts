import { useAssets } from './useAssets';
import { useLiabilities } from './useLiabilities';
import { useTransactions } from './useTransactions';
import { useForecast } from './useForecast';

export function useDashboard() {
  const assets = useAssets();
  const liabilities = useLiabilities();
  const transactions = useTransactions();
  const forecast = useForecast();

  const isLoading =
    assets.isLoading || liabilities.isLoading || transactions.isLoading || forecast.isLoading;

  return {
    assets: assets.data?.data ?? [],
    liabilities: liabilities.data?.data ?? [],
    transactions: transactions.data?.data ?? [],
    forecast: forecast.data?.forecast ?? { months: [], warningLevel: 'green' },
    autoForecast: forecast.data?.autoForecast ?? {
      monthlyIncome: '20000', monthlyExpense: '15000', activeMonths: 0, recurringExpenses: [],
    },
    forexRates: forecast.data?.forexRates ?? { usdToCny: 7.2, hkdToCny: 0.92, jpyToCny: 0.048 },
    pricesStale: assets.data?.pricesStale ?? false,
    isLoading,
    error: assets.error || liabilities.error || transactions.error || forecast.error,
  };
}

import useSWR from 'swr';
import { getAutoForecast, simulateCashflow } from '@/lib/actions/forecast';

export function useForecast(months: number = 12) {
  return useSWR(['forecast', months].join(':'), async () => {
    const autoRes = await getAutoForecast(months);
    const forecastData = autoRes.success
      ? autoRes.data!
      : { monthlyIncome: '20000', monthlyExpense: '15000', activeMonths: 0, recurringExpenses: [] };

    const simRes = await simulateCashflow({
      monthlyIncome: forecastData.monthlyIncome,
      monthlyExpense: forecastData.monthlyExpense,
      months,
    });

    return {
      autoForecast: forecastData,
      forecast: simRes.success ? simRes.data! : { months: [], warningLevel: 'green' },
      forexRates: (autoRes as any).forexRates ?? { usdToCny: 7.2, hkdToCny: 0.92, jpyToCny: 0.048 },
    };
  });
}

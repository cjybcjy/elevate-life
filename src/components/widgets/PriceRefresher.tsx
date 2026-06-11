'use client';

import { useEffect, useState } from 'react';
import { refreshMyPrices } from '@/lib/actions/assets';
import { useSWRConfig } from 'swr';

export function PriceRefresher({ pricesStale }: { pricesStale: boolean }) {
  const { mutate } = useSWRConfig();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Auto-refresh on mount if prices are stale (runs once when component mounts)
  useEffect(() => {
    if (pricesStale) {
      doRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricesStale]);

  async function doRefresh() {
    setRefreshing(true);
    setMessage(null);
    try {
      const result = await refreshMyPrices();
      if (result.success) {
        setMessage('价格已更新');
        // Invalidate SWR cache so all components using assets data re-fetch
        mutate('assets');
      } else {
        setMessage('部分价格更新失败');
      }
    } catch {
      setMessage('价格更新失败');
    } finally {
      setRefreshing(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={doRefresh}
        disabled={refreshing}
        className="px-3 py-1.5 text-xs bg-ledger-bg border border-ledger-primary/20 rounded-lg text-ledger-muted hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        <span className={`inline-block w-3.5 h-3.5 border-2 border-ledger-muted border-t-transparent rounded-full ${refreshing ? 'animate-spin' : 'hidden'}`} />
        刷新价格
      </button>
      {message && (
        <span className={`text-xs ${message.includes('失败') ? 'text-ledger-danger' : 'text-ledger-success'}`}>
          {message}
        </span>
      )}
    </div>
  );
}

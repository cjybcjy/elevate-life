'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSWRConfig } from 'swr';

interface PriceRefreshResponse {
  success: boolean;
  error?: string;
  assets?: {
    data: unknown[];
    pricesStale: boolean;
  };
}

export function PriceRefresher({ pricesStale }: { pricesStale: boolean }) {
  const { mutate } = useSWRConfig();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const autoRefreshStarted = useRef(false);

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const response = await fetch('/api/prices/refresh', { method: 'POST' });
      const result = await response.json() as PriceRefreshResponse;
      if (!response.ok) {
        throw new Error(result.error || '价格更新失败');
      }
      if (result.assets) {
        await mutate('assets', result.assets, { revalidate: false });
      }
      if (result.success) {
        setMessage('价格已更新');
      } else {
        setMessage('部分价格更新失败');
      }
    } catch {
      setMessage('价格更新失败');
    } finally {
      setRefreshing(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [mutate]);

  useEffect(() => {
    if (!pricesStale) {
      autoRefreshStarted.current = false;
      return;
    }

    if (autoRefreshStarted.current) return;
    autoRefreshStarted.current = true;
    void doRefresh();
  }, [doRefresh, pricesStale]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={doRefresh}
        disabled={refreshing}
        className="px-3 py-1.5 text-xs bg-ledger-bg border border-ledger-primary/20 rounded-lg text-ledger-muted hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        <span className={`inline-block w-3.5 h-3.5 border-2 border-ledger-muted border-t-transparent rounded-full ${refreshing ? 'animate-spin' : 'hidden'}`} />
        {refreshing ? '更新中…' : pricesStale ? '更新过期价格' : '刷新价格'}
      </button>
      {message && (
        <span className={`text-xs ${message.includes('失败') ? 'text-ledger-danger' : 'text-ledger-success'}`}>
          {message}
        </span>
      )}
    </div>
  );
}

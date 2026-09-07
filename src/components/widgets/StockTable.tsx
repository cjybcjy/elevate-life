'use client';

import { type FormEvent, useState } from 'react';
import { updateAsset } from '@/lib/actions/assets';
import { useRouter } from 'next/navigation';
import SerenityAnalysisPanel, { type SerenityAnalysisMessage } from '@/components/widgets/SerenityAnalysisPanel';
import {
  DEFAULT_FINANCE_AI_CONFIG,
  FINANCE_AI_CONFIG_STORAGE_KEY,
  FINANCE_AI_PROVIDER_PRESETS,
  hasCompleteFinanceAiConfig,
  type FinanceAiConfig,
} from '@/lib/finance-ai';
import type { SerenityStockSnapshot } from '@/lib/serenity-stock-ai';
import {
  clearStoredNumber,
  saveStoredNumber,
  STOCK_IDLE_CASH_STORAGE_KEY,
  STOCK_MANUAL_PRINCIPAL_STORAGE_KEY,
  useStoredNumber,
} from '@/hooks/useStoredNumber';

const marketLabel: Record<string, string> = { cn: 'A股', hk: '港股', us: '美股' };
const currencySymbol: Record<string, string> = { CNY: '¥', USD: '$', HKD: 'HK$', JPY: 'JP¥' };
const defaultCurrency = 'CNY';
const fallbackRates = { usdToCny: 7.25, hkdToCny: 0.92, jpyToCny: 0.048 };

const fmt = (val: number, cur?: string | null) => {
  const c = cur || defaultCurrency;
  return `${currencySymbol[c] || c}${Math.abs(val).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface Stock {
  id: string;
  name: string;
  stockCode?: string | null;
  market?: string | null;
  quantity?: number | null;
  costPrice?: string | null;
  costUnitPrice?: number | null;
  currentValue?: string | null;
  balance?: string;
  unitPrice?: number | null;
  priceCurrency?: string | null;
}

function CostCell({ stock }: { stock: Stock }) {
  const c = stock.priceCurrency || defaultCurrency;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const qty = stock.quantity || 0;
  const cup = stock.costUnitPrice || parseFloat(stock.costPrice || '0');
  const cost = cup * qty;

  async function save() {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    setSaving(true);
    await updateAsset(stock.id, { costUnitPrice: value });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <td className="py-2 px-3 text-right">
        <div className="inline-flex items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            className="w-24 rounded-md bg-ledger-bg border border-ledger-accent px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none"
            autoFocus
          />
          <button onClick={save} disabled={saving} className="text-xs text-green-400 hover:text-green-300 shrink-0">
            {saving ? '...' : '✓'}
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-ledger-muted hover:text-[var(--color-text-primary)] shrink-0">✕</button>
        </div>
      </td>
    );
  }

  return (
    <td
      className="py-2 px-3 text-right text-ledger-muted cursor-pointer hover:text-[var(--color-text-primary)] hover:bg-ledger-bg/50 transition-colors"
      onClick={() => { setValue(cup > 0 ? cup.toString() : ''); setEditing(true); }}
      title="点击修改成本价"
    >
      {cup > 0 ? (
        <div>
          <div>{fmt(cost, c)}</div>
          <div className="text-xs text-ledger-muted/60">单价 {fmt(cup, c)}</div>
        </div>
      ) : (
        <span className="text-xs text-ledger-muted/50">点击设置成本</span>
      )}
    </td>
  );
}

function EditablePrincipal({ totalCost, onSave }: { totalCost: number; onSave: (val: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  function doSave() {
    const n = parseFloat(value);
    if (!isNaN(n) && n > 0) { onSave(n); setEditing(false); }
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') doSave();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={() => { const n = parseFloat(value); if (!isNaN(n) && n > 0) { onSave(n); } setEditing(false); }}
          className="w-28 rounded-md bg-ledger-bg border border-ledger-accent px-2 py-0.5 text-xs text-[var(--color-text-primary)] focus:outline-none"
          autoFocus
        />
        <button onMouseDown={e => { e.preventDefault(); doSave(); }} className="text-xs text-green-400 hover:text-green-300">✓</button>
        <button onMouseDown={e => { e.preventDefault(); setEditing(false); }} className="text-xs text-ledger-muted hover:text-[var(--color-text-primary)]">✕</button>
      </span>
    );
  }

  return (
    <span
      className="text-[var(--color-text-primary)] font-medium cursor-pointer hover:text-ledger-accent border-b border-dashed border-ledger-muted/30"
      onClick={() => { setValue(totalCost > 0 ? totalCost.toString() : ''); setEditing(true); }}
      title="点击手动修改总本金"
    >
      {fmt(totalCost)}
    </span>
  );
}

interface ForexRates {
  usdToCny: number;
  hkdToCny: number;
  jpyToCny?: number;
}

function readStoredAiConfig(): FinanceAiConfig {
  if (typeof window === 'undefined') return DEFAULT_FINANCE_AI_CONFIG;

  try {
    const raw = localStorage.getItem(FINANCE_AI_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_FINANCE_AI_CONFIG;
    const parsed = JSON.parse(raw) as Partial<FinanceAiConfig>;

    return {
      provider: parsed.provider || DEFAULT_FINANCE_AI_CONFIG.provider,
      endpoint: parsed.endpoint || DEFAULT_FINANCE_AI_CONFIG.endpoint,
      apiKey: parsed.apiKey || '',
      model: parsed.model || DEFAULT_FINANCE_AI_CONFIG.model,
    };
  } catch {
    return DEFAULT_FINANCE_AI_CONFIG;
  }
}

export default function StockTable({
  stocks,
  forexRates,
  pricesStale = false,
}: {
  stocks: Stock[];
  forexRates?: ForexRates;
  pricesStale?: boolean;
}) {
  const rates = forexRates || fallbackRates;
  const cnyRate: Record<string, number> = { CNY: 1, HKD: rates.hkdToCny, USD: rates.usdToCny, JPY: rates.jpyToCny ?? fallbackRates.jpyToCny };

  function toCny(val: number, cur?: string | null): number {
    return val * (cnyRate[cur || defaultCurrency] || 1);
  }

  const marketStocks = stocks.filter((s) => s.stockCode && s.market);

  const totalValue = marketStocks.reduce((s, st) => s + toCny(parseFloat(st.currentValue || st.balance || '0'), st.priceCurrency), 0);
  const totalValueCny = totalValue;

  const computedCost = marketStocks.reduce((s, st) => {
    const qty = st.quantity || 0;
    const cup = st.costUnitPrice || parseFloat(st.costPrice || '0');
    return s + toCny(cup * qty, st.priceCurrency);
  }, 0);

  // useSyncExternalStore supplies a stable null server snapshot during hydration.
  const manualCost = useStoredNumber(STOCK_MANUAL_PRINCIPAL_STORAGE_KEY);
  const idleCash = useStoredNumber(STOCK_IDLE_CASH_STORAGE_KEY);
  const [aiConfig, setAiConfig] = useState<FinanceAiConfig>(() => readStoredAiConfig());
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<SerenityAnalysisMessage[]>([]);
  const [aiDraft, setAiDraft] = useState('');
  const [aiStatus, setAiStatus] = useState('');

  const totalCost = manualCost ?? computedCost;
  const totalPnl = totalValue - computedCost;
  const totalPnlRate = computedCost > 0 ? (totalPnl / computedCost) * 100 : 0;
  const accountTotal = idleCash !== null ? totalValueCny + idleCash : null;
  const aiProviderLabel = FINANCE_AI_PROVIDER_PRESETS[aiConfig.provider as keyof typeof FINANCE_AI_PROVIDER_PRESETS]?.label ?? '自定义模型';

  function saveManualCost(val: number) {
    saveStoredNumber(STOCK_MANUAL_PRINCIPAL_STORAGE_KEY, val);
  }
  function saveIdleCash(val: number) {
    saveStoredNumber(STOCK_IDLE_CASH_STORAGE_KEY, val);
  }

  function buildSerenitySnapshot(): SerenityStockSnapshot {
    const holdings = marketStocks.map((st) => {
      const value = parseFloat(st.currentValue || st.balance || '0');
      const qty = st.quantity || 0;
      const currency = st.priceCurrency || defaultCurrency;
      const cup = st.costUnitPrice || parseFloat(st.costPrice || '0');
      const cost = cup * qty;
      const pnl = value - cost;
      const pnlRate = cost > 0 ? (pnl / cost) * 100 : null;
      const marketValueCny = toCny(value, currency);

      return {
        name: st.name,
        stockCode: st.stockCode || '',
        market: st.market || 'cn',
        quantity: qty,
        unitPrice: st.unitPrice ?? null,
        priceCurrency: currency,
        marketValue: value,
        marketValueCny,
        costValue: cost,
        costValueCny: toCny(cost, currency),
        pnl,
        pnlCny: toCny(pnl, currency),
        pnlRate,
        weight: totalValueCny > 0 ? (marketValueCny / totalValueCny) * 100 : 0,
      };
    });

    return {
      currentDate: new Date().toISOString().slice(0, 10),
      totalValueCny,
      totalCostCny: computedCost,
      totalPnlCny: totalPnl,
      totalPnlRate: computedCost > 0 ? totalPnlRate : null,
      accountTotalCny: accountTotal,
      idleCashCny: idleCash,
      pricesStale,
      holdings,
    };
  }

  async function analyzeHoldings() {
    if (aiLoading) return;

    const latestConfig = readStoredAiConfig();
    setAiConfig(latestConfig);
    setAiOpen(true);

    if (!hasCompleteFinanceAiConfig(latestConfig)) {
      setAiMessages([]);
      setAiStatus('请先在右下角 AI 助手里保存 API 配置');
      return;
    }

    setAiStatus('');
    setAiLoading(true);

    try {
      const response = await fetch('/api/serenity-stock-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: latestConfig, snapshot: buildSerenitySnapshot() }),
      });
      const result = await response.json().catch(() => ({ success: false, error: 'AI 请求失败' }));

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'AI 请求失败');
      }

      setAiMessages([{ role: 'assistant', content: result.content }]);
      setAiDraft('');
    } catch (error) {
      setAiStatus(error instanceof Error ? error.message : 'AI 请求失败');
    } finally {
      setAiLoading(false);
    }
  }

  async function askFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = aiDraft.trim();
    if (!question || aiLoading) return;

    const latestConfig = readStoredAiConfig();
    setAiConfig(latestConfig);

    if (!hasCompleteFinanceAiConfig(latestConfig)) {
      setAiStatus('请先在右下角 AI 助手里保存 API 配置');
      return;
    }

    const history = aiMessages;
    const nextMessages: SerenityAnalysisMessage[] = [...history, { role: 'user', content: question }];

    setAiMessages(nextMessages);
    setAiDraft('');
    setAiStatus('');
    setAiLoading(true);

    try {
      const response = await fetch('/api/serenity-stock-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: latestConfig,
          snapshot: buildSerenitySnapshot(),
          question,
          messages: history,
        }),
      });
      const result = await response.json().catch(() => ({ success: false, error: 'AI 请求失败' }));

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'AI 请求失败');
      }

      setAiMessages([...nextMessages, { role: 'assistant', content: result.content }]);
    } catch (error) {
      setAiStatus(error instanceof Error ? error.message : 'AI 请求失败');
    } finally {
      setAiLoading(false);
    }
  }

  if (marketStocks.length === 0) {
    return <div className="py-8 text-center text-ledger-muted">暂无股票持仓，请在资产管理中添加股票资产并填写代码和市场</div>;
  }

  return (
    <div>
      {/* Title bar with account total */}
      {accountTotal !== null && (
        <div className="flex items-center mb-2">
          <span className="text-sm text-ledger-muted">
            账户总额 <span className="text-[var(--color-text-primary)] font-bold text-base">{fmt(accountTotal, 'CNY')}</span>
          </span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <span className="text-ledger-muted">
            本金 <EditablePrincipal totalCost={totalCost} onSave={saveManualCost} />
            {manualCost !== null && (
              <button
                onClick={() => clearStoredNumber(STOCK_MANUAL_PRINCIPAL_STORAGE_KEY)}
                className="ml-1 text-xs text-ledger-muted/50 hover:text-[var(--color-text-primary)]"
                title="恢复自动计算"
              >
                ↺
              </button>
            )}
          </span>
          <span className="text-ledger-muted/30">|</span>
          <span className="text-ledger-muted">市值 <span className="text-ledger-success font-medium">{fmt(totalValueCny, 'CNY')}</span></span>
          <span className="text-ledger-muted/30">|</span>
          <span className="text-ledger-muted">
            闲置现金 <EditablePrincipal totalCost={idleCash ?? 0} onSave={saveIdleCash} />
            {idleCash !== null && (
              <button
                onClick={() => clearStoredNumber(STOCK_IDLE_CASH_STORAGE_KEY)}
                className="ml-1 text-xs text-ledger-muted/50 hover:text-[var(--color-text-primary)]"
                title="清除"
              >
                ↺
              </button>
            )}
          </span>
          <span className="text-ledger-muted/30">|</span>
          <span className="text-ledger-muted">浮动盈亏 <span className={`font-medium ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalPnl >= 0 ? '+' : ''}{fmt(totalPnl, 'CNY')} ({totalPnlRate >= 0 ? '+' : ''}{totalPnlRate.toFixed(2)}%)</span></span>
          {manualCost !== null && <span className="text-xs text-ledger-accent">手动</span>}
        </div>
        <button
          type="button"
          onClick={analyzeHoldings}
          disabled={aiLoading}
          className="btn btn-outline btn-sm shrink-0"
          aria-label="用 Serenity AI 分析股票持仓"
        >
          {aiLoading ? '分析中...' : aiMessages.length > 0 ? '重新分析' : 'Serenity AI 分析'}
        </button>
      </div>
      {aiOpen && (
        <SerenityAnalysisPanel
          providerLabel={aiProviderLabel}
          messages={aiMessages}
          status={aiStatus}
          loading={aiLoading}
          draft={aiDraft}
          onDraftChange={setAiDraft}
          onSubmit={askFollowUp}
          onClose={() => setAiOpen(false)}
        />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ledger-primary/10 text-ledger-muted">
              <th className="text-left py-2 px-3">名称</th>
              <th className="text-left py-2 px-3">市场</th>
              <th className="text-left py-2 px-3">代码</th>
              <th className="text-right py-2 px-3">数量</th>
              <th className="text-right py-2 px-3">现价</th>
              <th className="text-right py-2 px-3">市值</th>
              <th className="text-right py-2 px-3">本金</th>
              <th className="text-right py-2 px-3">盈亏</th>
            </tr>
          </thead>
          <tbody>
            {marketStocks.map((s) => {
              const value = parseFloat(s.currentValue || s.balance || '0');
              const qty = s.quantity || 0;
              const cup = s.costUnitPrice || parseFloat(s.costPrice || '0');
              const cost = cup * qty;
              const pnl = value - cost;
              const pnlRate = cost > 0 ? (pnl / cost) * 100 : 0;
              const market = s.market || 'cn';
              return (
                <tr key={s.id} className="border-b border-ledger-primary/5 hover:bg-ledger-bg/30">
                  <td className="py-2 px-3 text-[var(--color-text-primary)]">{s.name}</td>
                  <td className="py-2 px-3"><span className="text-xs px-1.5 py-0.5 rounded bg-ledger-bg text-ledger-muted">{marketLabel[market] || market}</span></td>
                  <td className="py-2 px-3 text-ledger-muted font-mono">{s.stockCode || '-'}</td>
                  <td className="py-2 px-3 text-right text-[var(--color-text-primary)]">{qty || '-'}</td>
                  <td className="py-2 px-3 text-right text-[var(--color-text-primary)]">{s.unitPrice ? fmt(s.unitPrice, s.priceCurrency) : '-'}</td>
                  <td className="py-2 px-3 text-right text-[var(--color-text-primary)] font-medium">
                    {fmt(value, s.priceCurrency)}
                    {s.priceCurrency && s.priceCurrency !== 'CNY' && (
                      <div className="text-xs text-ledger-muted">≈ ¥{toCny(value, s.priceCurrency).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
                    )}
                  </td>
                  <CostCell stock={s} />
                  <td className="py-2 px-3 text-right">
                    {cost > 0 ? (
                      <div>
                        <span className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {pnl >= 0 ? '+' : ''}{fmt(pnl, s.priceCurrency)} ({pnlRate >= 0 ? '+' : ''}{pnlRate.toFixed(1)}%)
                        </span>
                        {s.priceCurrency && s.priceCurrency !== 'CNY' && (
                          <div className="text-xs text-ledger-muted">≈ ¥{toCny(pnl, s.priceCurrency).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-ledger-muted/50 text-xs">需设置成本</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

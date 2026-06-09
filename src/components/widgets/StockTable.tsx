'use client';

import { useState, useEffect } from 'react';
import { updateAsset } from '@/lib/actions/assets';
import { useRouter } from 'next/navigation';

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
            type="number"
            step="0.01"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            className="w-24 rounded-md bg-ledger-bg border border-ledger-accent px-2 py-1 text-xs text-white focus:outline-none"
            autoFocus
          />
          <button onClick={save} disabled={saving} className="text-xs text-green-400 hover:text-green-300 shrink-0">
            {saving ? '...' : '✓'}
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-ledger-muted hover:text-white shrink-0">✕</button>
        </div>
      </td>
    );
  }

  return (
    <td
      className="py-2 px-3 text-right text-ledger-muted cursor-pointer hover:text-white hover:bg-ledger-bg/50 transition-colors"
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
          type="number"
          step="0.01"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') doSave();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={() => { const n = parseFloat(value); if (!isNaN(n) && n > 0) { onSave(n); } setEditing(false); }}
          className="w-28 rounded-md bg-ledger-bg border border-ledger-accent px-2 py-0.5 text-xs text-white focus:outline-none"
          autoFocus
        />
        <button onMouseDown={e => { e.preventDefault(); doSave(); }} className="text-xs text-green-400 hover:text-green-300">✓</button>
        <button onMouseDown={e => { e.preventDefault(); setEditing(false); }} className="text-xs text-ledger-muted hover:text-white">✕</button>
      </span>
    );
  }

  return (
    <span
      className="text-white font-medium cursor-pointer hover:text-ledger-accent border-b border-dashed border-ledger-muted/30"
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
}

export default function StockTable({ stocks, forexRates }: { stocks: Stock[]; forexRates?: ForexRates }) {
  const rates = forexRates || fallbackRates;
  const cnyRate: Record<string, number> = { CNY: 1, HKD: rates.hkdToCny, USD: rates.usdToCny };

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

  // Manual overrides from localStorage — init null to avoid hydration mismatch
  const [manualCost, setManualCost] = useState<number | null>(null);
  const [idleCash, setIdleCash] = useState<number | null>(null);

  useEffect(() => {
    try {
      const mc = localStorage.getItem('stock-manual-principal');
      if (mc) setManualCost(parseFloat(mc));
      const ic = localStorage.getItem('stock-idle-cash');
      if (ic) setIdleCash(parseFloat(ic));
    } catch {}
  }, []);

  const totalCost = manualCost ?? computedCost;
  const totalPnl = totalValue - computedCost;
  const totalPnlRate = computedCost > 0 ? (totalPnl / computedCost) * 100 : 0;
  const accountTotal = idleCash !== null ? totalValueCny + idleCash : null;

  function saveManualCost(val: number) {
    setManualCost(val);
    try { localStorage.setItem('stock-manual-principal', val.toString()); } catch {}
  }
  function saveIdleCash(val: number) {
    setIdleCash(val);
    try { localStorage.setItem('stock-idle-cash', val.toString()); } catch {}
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
            账户总额 <span className="text-white font-bold text-base">{fmt(accountTotal, 'CNY')}</span>
          </span>
        </div>
      )}
      <div className="flex items-center gap-3 text-sm mb-3 flex-wrap">
        <span className="text-ledger-muted">
          本金 <EditablePrincipal totalCost={totalCost} onSave={saveManualCost} />
          {manualCost !== null && (
            <button
              onClick={() => { setManualCost(null); try { localStorage.removeItem('stock-manual-principal'); } catch {} }}
              className="ml-1 text-xs text-ledger-muted/50 hover:text-white"
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
              onClick={() => { setIdleCash(null); try { localStorage.removeItem('stock-idle-cash'); } catch {} }}
              className="ml-1 text-xs text-ledger-muted/50 hover:text-white"
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
                  <td className="py-2 px-3 text-white">{s.name}</td>
                  <td className="py-2 px-3"><span className="text-xs px-1.5 py-0.5 rounded bg-ledger-bg text-ledger-muted">{marketLabel[market] || market}</span></td>
                  <td className="py-2 px-3 text-ledger-muted font-mono">{s.stockCode || '-'}</td>
                  <td className="py-2 px-3 text-right text-white">{qty || '-'}</td>
                  <td className="py-2 px-3 text-right text-white">{s.unitPrice ? fmt(s.unitPrice, s.priceCurrency) : '-'}</td>
                  <td className="py-2 px-3 text-right text-white font-medium">
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

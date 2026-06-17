'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AmountDisplay } from '@/components/common/AmountDisplay';

interface AssetAccount {
  id: string;
  name: string;
  category?: string | null;
  balance?: string | null;
  currency?: string | null;
  liquidityTier?: string | null;
  quantity?: number | null;
  stockCode?: string | null;
  market?: string | null;
  priceCurrency?: string | null;
  updatedAt?: string | Date | null;
}

interface AccountTransaction {
  id: string;
  type: string;
  amount: string;
  currency?: string | null;
  description?: string | null;
  occurredAt: string | Date;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  category?: { name?: string | null } | null;
  budget?: { name?: string | null } | null;
}

interface Props {
  assets: AssetAccount[];
  transactions: AccountTransaction[];
}

const categoryLabel: Record<string, string> = {
  real_estate: '房产',
  cash: '现金',
  current_deposit: '银行活期',
  provident_fund: '公积金账户',
  pension: '养老账户',
  gold_physical: '实物黄金',
  gold_paper: '纸黄金',
  stock: '股票',
  fund: '基金',
  bond: '债券',
  vehicle: '车辆',
  other: '其他',
};

const liquidityLabel: Record<string, string> = {
  tier1: '一级流动性',
  tier2: '二级流动性',
  tier3: '长期资产',
  illiquid: '低流动性',
};

const currencySymbol: Record<string, string> = {
  CNY: '¥',
  HKD: 'HK$',
  USD: '$',
  JPY: '¥',
};

function parseAmount(value?: string | null) {
  const parsed = Number.parseFloat(value || '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function prefix(currency?: string | null) {
  return currencySymbol[currency || 'CNY'] || `${currency} `;
}

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function toMonthKey(value: string | Date) {
  const date = toDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(value: string | Date) {
  return toDate(value).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}

function transactionDirection(transaction: AccountTransaction, accountId: string) {
  if (transaction.toAccountId === accountId && transaction.fromAccountId !== accountId) return 'in';
  if (transaction.fromAccountId === accountId && transaction.toAccountId !== accountId) return 'out';
  if (transaction.type.toUpperCase() === 'INCOME') return 'in';
  if (transaction.type.toUpperCase() === 'EXPENSE') return 'out';
  return 'neutral';
}

export default function AccountViewLayer({ assets, transactions }: Props) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(assets[0]?.id ?? null);

  const selectedAccount = assets.find((asset) => asset.id === selectedAccountId) ?? assets[0] ?? null;
  const currentMonthKey = toMonthKey(new Date());

  const accountTransactions = useMemo(() => {
    if (!selectedAccount) return [];

    return transactions
      .filter((transaction) => (
        transaction.fromAccountId === selectedAccount.id ||
        transaction.toAccountId === selectedAccount.id
      ))
      .sort((a, b) => toDate(b.occurredAt).getTime() - toDate(a.occurredAt).getTime());
  }, [selectedAccount, transactions]);

  const missingSourceTransactions = useMemo(() => (
    transactions
      .filter((transaction) => transaction.type.toUpperCase() === 'EXPENSE' && !transaction.fromAccountId)
      .sort((a, b) => toDate(b.occurredAt).getTime() - toDate(a.occurredAt).getTime())
  ), [transactions]);

  const monthlyFlow = accountTransactions.reduce((summary, transaction) => {
    if (toMonthKey(transaction.occurredAt) !== currentMonthKey) return summary;

    const amount = parseAmount(transaction.amount);
    const direction = selectedAccount ? transactionDirection(transaction, selectedAccount.id) : 'neutral';

    if (direction === 'in') summary.inflow += amount;
    if (direction === 'out') summary.outflow += amount;

    return summary;
  }, { inflow: 0, outflow: 0 });

  const netFlow = monthlyFlow.inflow - monthlyFlow.outflow;
  const recentTransactions = accountTransactions.slice(0, 5);
  const missingSourcePreview = missingSourceTransactions.slice(0, 3);
  const selectedCurrencyPrefix = prefix(selectedAccount?.priceCurrency || selectedAccount?.currency);

  if (assets.length === 0) {
    return (
      <section className="mb-6 rounded-xl bg-ledger-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>资金账户</h2>
            <p className="mt-1 text-sm text-ledger-muted">先创建一个银行卡、现金或投资账户，再查看资金余额、资金流水和资金流变化。</p>
          </div>
          <Link href="/management/assets" className="btn btn-outline btn-sm">创建资金账户</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-xl bg-ledger-surface p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>资金账户</h2>
          <p className="mt-1 text-sm text-ledger-muted">从一个资金账户进入余额、资金流水和本月资金流；不选择来源也可以只记总收入支出。</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/management/ledger?needsSource=1" className="btn btn-outline btn-sm">补来源资金账户</Link>
          <Link href="/management/assets" className="btn btn-outline btn-sm">管理资产</Link>
        </div>
      </div>

      {missingSourceTransactions.length > 0 && (
        <div className="mb-4 rounded-lg border border-ledger-accent/30 bg-ledger-accent/10 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>待补来源资金账户</div>
              <p className="mt-1 text-xs text-ledger-muted">
                {missingSourceTransactions.length} 笔支出还不知道从哪张卡、现金或投资账户扣款，补齐后资金账户余额才会更可信。
              </p>
            </div>
            <Link href="/management/ledger?needsSource=1" className="btn btn-outline btn-sm">去流水处理</Link>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {missingSourcePreview.map((transaction) => (
              <div key={transaction.id} className="rounded-md border border-ledger-bg bg-ledger-surface px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-ledger-muted">{formatDate(transaction.occurredAt)}</span>
                  <span className="font-medium text-red-400">
                    <AmountDisplay amount={-parseAmount(transaction.amount)} prefix={prefix(transaction.currency)} showSign />
                  </span>
                </div>
                <div className="mt-1 truncate text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  {transaction.description || transaction.category?.name || transaction.budget?.name || '未备注支出'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-2">
          {assets.map((asset) => {
            const selected = asset.id === selectedAccount?.id;
            const accountFlowCount = transactions.filter((transaction) => (
              transaction.fromAccountId === asset.id ||
              transaction.toAccountId === asset.id
            )).length;

            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => setSelectedAccountId(asset.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                  selected
                    ? 'border-ledger-accent bg-ledger-accent/10'
                    : 'border-ledger-bg bg-ledger-bg/40 hover:border-ledger-accent/50'
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {asset.name}
                    </span>
                    <span className="mt-1 block text-xs text-ledger-muted">
                      {categoryLabel[asset.category || 'other'] || asset.category || '其他'} · {accountFlowCount} 笔资金流水
                    </span>
                  </span>
                  <AmountDisplay
                    amount={parseAmount(asset.balance)}
                    prefix={prefix(asset.priceCurrency || asset.currency)}
                    className="shrink-0 text-sm font-medium"
                  />
                </span>
              </button>
            );
          })}
        </div>

        {selectedAccount && (
          <div className="rounded-lg border border-ledger-bg bg-ledger-bg/30 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs text-ledger-muted">当前资金账户</div>
                <h3 className="mt-1 text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{selectedAccount.name}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-ledger-muted">
                  <span>{categoryLabel[selectedAccount.category || 'other'] || selectedAccount.category || '其他'}</span>
                  <span>·</span>
                  <span>{liquidityLabel[selectedAccount.liquidityTier || ''] || '未标记流动性'}</span>
                  {selectedAccount.stockCode && (
                    <>
                      <span>·</span>
                      <span className="font-mono">{selectedAccount.stockCode}</span>
                    </>
                  )}
                  {selectedAccount.quantity !== null && selectedAccount.quantity !== undefined && (
                    <>
                      <span>·</span>
                      <span>持有 {selectedAccount.quantity}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-ledger-muted">资金余额</div>
                <div className="mt-1 text-xl font-bold">
                  <AmountDisplay
                    amount={parseAmount(selectedAccount.balance)}
                    prefix={prefix(selectedAccount.priceCurrency || selectedAccount.currency)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-ledger-bg bg-ledger-surface p-3">
                <div className="text-xs text-ledger-muted">本月流入</div>
                <div className="mt-1 text-sm font-semibold text-green-400">
                  <AmountDisplay amount={monthlyFlow.inflow} prefix={selectedCurrencyPrefix} />
                </div>
              </div>
              <div className="rounded-lg border border-ledger-bg bg-ledger-surface p-3">
                <div className="text-xs text-ledger-muted">本月流出</div>
                <div className="mt-1 text-sm font-semibold text-red-400">
                  <AmountDisplay amount={monthlyFlow.outflow} prefix={selectedCurrencyPrefix} />
                </div>
              </div>
              <div className="rounded-lg border border-ledger-bg bg-ledger-surface p-3">
                <div className="text-xs text-ledger-muted">净流入</div>
                <div className={netFlow >= 0 ? 'mt-1 text-sm font-semibold text-green-400' : 'mt-1 text-sm font-semibold text-red-400'}>
                  <AmountDisplay amount={netFlow} prefix={selectedCurrencyPrefix} showSign />
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>最近流水</div>
                <div className="text-xs text-ledger-muted">共 {accountTransactions.length} 笔资金流水</div>
              </div>

              {recentTransactions.length > 0 ? (
                <div className="divide-y divide-ledger-bg rounded-lg border border-ledger-bg">
                  {recentTransactions.map((transaction) => {
                    const direction = transactionDirection(transaction, selectedAccount.id);
                    const isOut = direction === 'out';
                    const label = transaction.description || transaction.category?.name || transaction.budget?.name || '未备注流水';

                    return (
                      <div key={transaction.id} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 px-3 py-2 text-sm">
                        <span className="text-xs text-ledger-muted">{formatDate(transaction.occurredAt)}</span>
                        <span className="min-w-0">
                          <span className="block truncate" style={{ color: 'var(--color-text-primary)' }}>{label}</span>
                          <span className="mt-0.5 block text-xs text-ledger-muted">
                            {direction === 'in' ? '流入' : direction === 'out' ? '流出' : '账户调整'}
                          </span>
                        </span>
                        <span className={isOut ? 'font-medium text-red-400' : 'font-medium text-green-400'}>
                          <AmountDisplay
                            amount={isOut ? -parseAmount(transaction.amount) : parseAmount(transaction.amount)}
                            prefix={prefix(transaction.currency)}
                            showSign
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-ledger-bg px-4 py-6 text-center text-sm text-ledger-muted">
                  这个资金账户还没有关联流水。记录收入、支出或转账时选择来源/目标资金账户后，这里会自动形成资金流水。
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

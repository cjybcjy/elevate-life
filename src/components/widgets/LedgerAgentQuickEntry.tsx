'use client';

import { useState } from 'react';
import { buildLedgerAgentDraft, type LedgerAgentDraft } from '@/lib/ledger-agent';

type LedgerAgentQuickEntryProps = {
  categories: Array<{ id: string; name: string; type?: string | null }>;
  assets: Array<{ id: string; name: string }>;
  onApply: (draft: LedgerAgentDraft) => void;
  examples?: string[];
  title?: string;
  actionLabel?: string;
  embedded?: boolean;
};

const defaultExamples = [
  '昨天午饭 32 用招行',
  '今天工资收入 18000 到招商银行卡',
  '7月8日地铁 6 用现金',
];

function summarizeDraft(draft: LedgerAgentDraft) {
  const typeLabel = draft.type === 'INCOME' ? '收入' : draft.type === 'TRANSFER' ? '转账' : '支出';
  const currencyLabel = draft.currency === 'CNY' ? '¥' : draft.currency;
  return `${typeLabel} ${currencyLabel}${draft.amount} · ${draft.occurredAt}`;
}

export default function LedgerAgentQuickEntry({
  categories,
  assets,
  onApply,
  examples = defaultExamples,
  title = 'Agent 记一笔',
  actionLabel = '生成草稿',
  embedded = false,
}: LedgerAgentQuickEntryProps) {
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'neutral' | 'success' | 'error'>('neutral');

  function applyAgentDraft() {
    const result = buildLedgerAgentDraft(input, { categories, assets });

    if (!result.success || !result.draft) {
      setTone('error');
      setMessage(result.error ?? '没有生成可用草稿');
      return;
    }

    onApply(result.draft);
    setTone('success');
    setMessage(`${summarizeDraft(result.draft)} · ${result.draft.notes.join('，')}`);
  }

  const messageClass = tone === 'error'
    ? 'text-ledger-danger'
    : tone === 'success'
      ? 'text-ledger-success'
      : 'text-ledger-muted';

  return (
    <section className={`${embedded ? '' : 'mb-4 '}rounded-lg border border-ledger-primary/15 bg-ledger-surface px-3 py-3`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-semibold text-ledger-muted" htmlFor="ledger-agent-input">
            {title}
          </label>
          <input
            id="ledger-agent-input"
            type="text"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (message) setMessage('');
              if (tone !== 'neutral') setTone('neutral');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && input.trim()) {
                event.preventDefault();
                applyAgentDraft();
              }
            }}
            className="min-h-11 w-full rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:border-ledger-accent focus:outline-none"
            placeholder="例如：昨天午饭 32 用招行"
          />
        </div>
        <button
          type="button"
          onClick={applyAgentDraft}
          disabled={!input.trim()}
          className="min-h-11 rounded-md bg-ledger-accent px-4 text-sm font-medium text-[var(--color-text-inverse)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {actionLabel}
        </button>
      </div>
      {message && (
        <div className={`mt-2 text-xs ${messageClass}`} role={tone === 'error' ? 'alert' : 'status'}>
          {message}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Agent 记账示例">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setInput(example);
              setMessage('');
              setTone('neutral');
            }}
            className="min-h-11 rounded-md border border-ledger-primary/15 bg-ledger-bg px-2 py-1 text-left text-[11px] leading-snug text-ledger-muted transition-colors hover:border-ledger-accent hover:text-[var(--color-text-primary)]"
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}

'use client';

import { Delete } from 'lucide-react';
import type { AmountKey } from '@/lib/ledger-quick-entry';

const keys: Array<{ key: AmountKey; label: string; aria: string }> = [
  { key: '7', label: '7', aria: '7' },
  { key: '8', label: '8', aria: '8' },
  { key: '9', label: '9', aria: '9' },
  { key: 'backspace', label: '', aria: '退格' },
  { key: '4', label: '4', aria: '4' },
  { key: '5', label: '5', aria: '5' },
  { key: '6', label: '6', aria: '6' },
  { key: '+', label: '+', aria: '加' },
  { key: '1', label: '1', aria: '1' },
  { key: '2', label: '2', aria: '2' },
  { key: '3', label: '3', aria: '3' },
  { key: '-', label: '−', aria: '减' },
  { key: '00', label: '00', aria: '00' },
  { key: '0', label: '0', aria: '0' },
  { key: '.', label: '.', aria: '小数点' },
];

export default function AmountKeypad({
  onKey,
  onComplete,
  completeLabel,
  completeDisabled = false,
  completeBusy = false,
}: {
  onKey: (key: AmountKey) => void;
  onComplete: () => void | Promise<void>;
  completeLabel: string;
  completeDisabled?: boolean;
  completeBusy?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-2" aria-label="金额键盘">
      {keys.map((item) => (
        <button
          key={item.key}
          type="button"
          data-amount-key={item.key}
          aria-label={item.aria}
          onClick={() => onKey(item.key)}
          className="min-h-12 min-w-11 rounded-xl border border-[var(--border-tertiary)] bg-[var(--color-container)] text-lg font-semibold text-[var(--color-text-primary)] active:scale-95"
        >
          {item.key === 'backspace'
            ? <Delete className="mx-auto" size={20} aria-hidden />
            : item.label}
        </button>
      ))}
      <button
        type="button"
        data-amount-complete="true"
        aria-label={completeLabel}
        aria-busy={completeBusy}
        disabled={completeDisabled}
        onClick={onComplete}
        className="min-h-12 min-w-11 rounded-xl bg-[var(--color-accent)] px-1 text-xs font-bold tabular-nums text-[var(--color-text-inverse)] active:scale-95 disabled:opacity-50 sm:text-sm"
      >
        <span className="block truncate">{completeLabel}</span>
      </button>
    </div>
  );
}

'use client';

import { Delete } from 'lucide-react';
import type { AmountKey } from '@/lib/ledger-quick-entry';

const keys: Array<{ key: AmountKey; label: string; aria: string }> = [
  { key: '1', label: '1', aria: '1' },
  { key: '2', label: '2', aria: '2' },
  { key: '3', label: '3', aria: '3' },
  { key: '+', label: '+', aria: '加' },
  { key: 'backspace', label: '', aria: '退格' },
  { key: '4', label: '4', aria: '4' },
  { key: '5', label: '5', aria: '5' },
  { key: '6', label: '6', aria: '6' },
  { key: '-', label: '−', aria: '减' },
  { key: '.', label: '.', aria: '小数点' },
  { key: '7', label: '7', aria: '7' },
  { key: '8', label: '8', aria: '8' },
  { key: '9', label: '9', aria: '9' },
  { key: '0', label: '0', aria: '0' },
  { key: '00', label: '00', aria: '00' },
];

export default function AmountKeypad({ onKey }: { onKey: (key: AmountKey) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2" aria-label="金额键盘">
      {keys.map((item) => (
        <button
          key={item.key}
          type="button"
          data-amount-key={item.key}
          aria-label={item.aria}
          onClick={() => onKey(item.key)}
          className="min-h-11 rounded-xl border border-[var(--border-tertiary)] bg-[var(--color-container)] text-lg font-semibold text-[var(--color-text-primary)] active:scale-95"
        >
          {item.key === 'backspace'
            ? <Delete className="mx-auto" size={20} aria-hidden />
            : item.label}
        </button>
      ))}
    </div>
  );
}

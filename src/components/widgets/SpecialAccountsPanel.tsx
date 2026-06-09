'use client';

import { useState } from 'react';
import { AmountDisplay } from '../common/AmountDisplay';

const collapsibleCats = new Set(['provident_fund', 'pension', 'gold_physical', 'gold_paper']);

export function isCollapsibleCat(cat: string) { return collapsibleCats.has(cat); }

export function ExpandableDetail({ cat, assets }: { cat: string; assets: any[] }) {
  const [open, setOpen] = useState(false);
  const items = assets.filter((a: any) => (a.category || 'other') === cat);
  if (items.length <= 1) return null;

  const isGold = cat === 'gold_physical' || cat === 'gold_paper';

  return (
    <>
      <button type="button" onClick={() => setOpen(!open)} className="text-ledger-muted hover:text-white">
        {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="w-full ml-6 mt-0.5 space-y-0.5">
          {items.map((a: any) => (
            <div key={a.id} className="flex items-center gap-2 text-xs text-ledger-muted">
              <span className="truncate flex-1">{a.name}</span>
              {isGold && a.quantity > 0 && <span className="shrink-0">{Number(a.quantity).toFixed(2)}克</span>}
              {isGold && a.unitPrice > 0 && <span className="shrink-0 text-ledger-muted/60">¥{Number(a.unitPrice).toFixed(0)}/克</span>}
              <AmountDisplay amount={parseFloat(a.balance || '0')} className="shrink-0" sensitive />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

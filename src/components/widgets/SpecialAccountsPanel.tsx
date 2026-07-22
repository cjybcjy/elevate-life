'use client';

import { useState } from 'react';
import { AmountDisplay } from '../common/AmountDisplay';
import {
  getAssetDisplayGroupKey,
  isGoldAssetCategory,
} from '@/lib/asset-special-groups';

const collapsibleCats = new Set(['provident_fund', 'pension', 'gold', 'current_deposit']);

export function isCollapsibleCat(cat: string) { return collapsibleCats.has(cat); }

type ExpandableDetailProps = {
  cat: string;
  assets: any[];
  color: string;
  label: string;
};

function AssetGroupColorLabel({ color, label }: { color: string; label: string }) {
  return (
    <>
      <span style={{
        display: 'inline-block', width: 10, height: 10, borderRadius: 2.5,
        background: color, flexShrink: 0,
      }} />
      <span style={{ color: 'var(--color-text-primary)' }}>{label}</span>
    </>
  );
}

export function ExpandableDetail({ cat, assets, color, label }: ExpandableDetailProps) {
  const [open, setOpen] = useState(false);
  const items = assets.filter((a: any) => getAssetDisplayGroupKey(a.category) === cat);
  if (items.length <= 1) return <AssetGroupColorLabel color={color} label={label} />;

  const isGold = cat === 'gold';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={`${open ? '收起' : '展开'}${label}明细`}
        title={`${open ? '收起' : '展开'}${label}明细`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          border: 0,
          margin: 0,
          padding: 0,
          background: 'transparent',
          color: 'var(--color-text-primary)',
          font: 'inherit',
          cursor: 'pointer',
        }}
      >
        <AssetGroupColorLabel color={color} label={label} />
      </button>
      {open && (
        <div className="mt-1 space-y-1" style={{ flexBasis: '100%', marginLeft: 24, order: 2 }}>
          {items.map((a: any) => (
            <div key={a.id} className="flex items-start justify-between gap-2 text-xs text-ledger-muted">
              <span className="min-w-0 flex-1">
                <span className="block truncate">{a.name}</span>
                {isGold && isGoldAssetCategory(a.category) && (
                  <span className="flex flex-wrap gap-x-2 text-ledger-muted/60">
                    <span>{a.category === 'gold_paper' ? '纸黄金' : '实物黄金'}</span>
                    {a.quantity > 0 && <span>{Number(a.quantity).toFixed(2)}克</span>}
                    {a.unitPrice > 0 && <span>¥{Number(a.unitPrice).toFixed(0)}/克</span>}
                  </span>
                )}
              </span>
              <AmountDisplay amount={parseFloat(a.balance || '0')} className="shrink-0" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

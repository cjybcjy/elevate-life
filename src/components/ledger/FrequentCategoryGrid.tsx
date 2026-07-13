'use client';

import {
  Bus,
  ChartNoAxesCombined,
  CircleEllipsis,
  Gift,
  HeartPulse,
  House,
  Plane,
  ReceiptText,
  ShoppingBasket,
  Sparkles,
  Tags,
  Utensils,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import {
  partitionQuickEntryCategories,
  type QuickEntryCategory,
  type QuickEntryType,
} from '@/lib/ledger-quick-entry';

const categoryIcons: Record<string, LucideIcon> = {
  餐饮: Utensils,
  房租: House,
  交通: Bus,
  医疗: HeartPulse,
  固定支出: ReceiptText,
  日用: ShoppingBasket,
  提升品质: Sparkles,
  旅行: Plane,
  人情往来: Gift,
  工资: WalletCards,
  理财收益: ChartNoAxesCombined,
};

export function CategoryIcon({ name, size = 24 }: { name: string; size?: number }) {
  const Icon = categoryIcons[name] ?? Tags;
  return (
    <Icon
      size={size}
      strokeWidth={1.8}
      data-category-icon={categoryIcons[name] ? name : 'fallback'}
      aria-hidden
    />
  );
}

export default function FrequentCategoryGrid({
  categories,
  type,
  selectedId,
  onSelect,
  onMore,
}: {
  categories: QuickEntryCategory[];
  type: Exclude<QuickEntryType, 'TRANSFER'>;
  selectedId: string;
  onSelect: (id: string) => void;
  onMore: () => void;
}) {
  const { primary } = partitionQuickEntryCategories(categories, type);

  return (
    <div className="grid grid-cols-4 gap-2" aria-label="常用分类">
      {primary.map((category) => (
        <button
          key={category.id}
          type="button"
          data-quick-category={category.name}
          aria-pressed={selectedId === category.id}
          onClick={() => onSelect(category.id)}
          className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-xl border border-[var(--border-tertiary)] bg-[var(--color-container)] px-1 py-2 text-xs text-[var(--color-text-primary)] aria-pressed:border-[var(--color-accent)] aria-pressed:bg-[var(--color-sidebar-active-bg)]"
        >
          <CategoryIcon name={category.name} />
          <span className="w-full truncate">{category.name}</span>
        </button>
      ))}
      <button
        type="button"
        aria-label="更多分类"
        onClick={onMore}
        className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-xl border border-[var(--border-tertiary)] bg-[var(--color-container)] px-1 py-2 text-xs text-[var(--color-text-secondary)]"
      >
        <CircleEllipsis size={24} strokeWidth={1.8} aria-hidden />
        <span>更多</span>
      </button>
    </div>
  );
}

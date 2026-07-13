export type LedgerCategoryType = 'EXPENSE' | 'INCOME';

export type LedgerCategoryPreset = {
  name: string;
  type: LedgerCategoryType;
  icon: string;
  color: string;
  isEssential?: boolean;
};

export const QUICK_ENTRY_CATEGORY_ORDER: Record<LedgerCategoryType, readonly string[]> = {
  EXPENSE: ['餐饮', '房租', '交通', '医疗', '固定支出', '日用', '提升品质', '旅行', '人情往来'],
  INCOME: ['工资', '理财收益', '人情往来'],
};

export const LEDGER_CATEGORY_PRESETS: readonly LedgerCategoryPreset[] = [
  { name: '工资', type: 'INCOME', icon: '薪', color: '#10b981' },
  { name: '理财收益', type: 'INCOME', icon: '收', color: '#14b8a6' },
  { name: '人情往来', type: 'INCOME', icon: '礼', color: '#ec4899' },
  { name: '餐饮', type: 'EXPENSE', icon: '餐', color: '#ef4444', isEssential: true },
  { name: '房租', type: 'EXPENSE', icon: '住', color: '#f59e0b', isEssential: true },
  { name: '交通', type: 'EXPENSE', icon: '行', color: '#3b82f6' },
  { name: '医疗', type: 'EXPENSE', icon: '医', color: '#ef4444' },
  { name: '固定支出', type: 'EXPENSE', icon: '固', color: '#f59e0b', isEssential: true },
  { name: '日用', type: 'EXPENSE', icon: '用', color: '#64748b' },
  { name: '提升品质', type: 'EXPENSE', icon: '品', color: '#8b5cf6' },
  { name: '旅行', type: 'EXPENSE', icon: '旅', color: '#06b6d4' },
  { name: '人情往来', type: 'EXPENSE', icon: '礼', color: '#ec4899' },
];

export function ledgerCategoryKey(type: string, name: string) {
  return `${type}:${name}`;
}

export function findMissingLedgerCategoryPresets(
  existing: ReadonlyArray<{ name: string; type: string }>,
) {
  const existingKeys = new Set(existing.map((item) => ledgerCategoryKey(item.type, item.name)));
  return LEDGER_CATEGORY_PRESETS.filter(
    (item) => !existingKeys.has(ledgerCategoryKey(item.type, item.name)),
  );
}

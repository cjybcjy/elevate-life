export interface SpecialAsset {
  id: string;
  name: string;
  category?: string | null;
  balance?: string | null;
  quantity?: number | null;
}

export interface SpecialAssetGroupConfig {
  icon: string;
  label: string;
}

export interface SpecialAssetGroup extends SpecialAssetGroupConfig {
  assets: SpecialAsset[];
  total: number;
  quantityTotal: number;
}

const goldCategories = new Set(['gold_physical', 'gold_paper']);

export const specialAssetGroupConfig: Record<string, SpecialAssetGroupConfig> = {
  provident_fund: { icon: '🏦', label: '公积金' },
  pension: { icon: '🏛️', label: '养老保险' },
  current_deposit: { icon: '💳', label: '银行活期' },
  gold: { icon: '🟡', label: '黄金' },
};

export function isGoldAssetCategory(category?: string | null) {
  return Boolean(category && goldCategories.has(category));
}

export function getAssetDisplayGroupKey(category?: string | null) {
  if (isGoldAssetCategory(category)) return 'gold';
  return category || 'other';
}

export function parseSpecialAssetBalance(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function parseSpecialAssetQuantity(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function buildSpecialAssetGroups(assets: SpecialAsset[]) {
  const groups: Record<string, SpecialAssetGroup> = {};

  for (const asset of assets) {
    const category = getAssetDisplayGroupKey(asset.category);
    const config = specialAssetGroupConfig[category];
    if (!config) continue;

    groups[category] ??= { ...config, assets: [], total: 0, quantityTotal: 0 };
    groups[category].assets.push(asset);
    groups[category].total += parseSpecialAssetBalance(asset.balance);
    groups[category].quantityTotal += parseSpecialAssetQuantity(asset.quantity);
  }

  return groups;
}

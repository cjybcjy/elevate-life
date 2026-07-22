export interface GoalDepositAsset {
  id: string;
  name: string;
  category?: string | null;
  balance?: string | number | null;
  currency?: string | null;
}

const GOAL_DEPOSIT_SOURCE_CATEGORIES = new Set(['cash', 'current_deposit']);

export function isGoalDepositAccountCategory(category?: string | null) {
  return Boolean(category && GOAL_DEPOSIT_SOURCE_CATEGORIES.has(category));
}

function parseBalance(value: GoalDepositAsset['balance']) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value || '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getGoalDepositSourceOptions(
  assets: GoalDepositAsset[],
  targetAssetId?: string | null,
  targetCurrency = 'CNY',
) {
  const normalizedCurrency = targetCurrency.toUpperCase();

  return assets
    .filter((asset) => (
      asset.id !== targetAssetId
      && isGoalDepositAccountCategory(asset.category)
      && (asset.currency || 'CNY').toUpperCase() === normalizedCurrency
      && parseBalance(asset.balance) > 0
    ))
    .sort((left, right) => parseBalance(right.balance) - parseBalance(left.balance));
}

export function getGoalDepositBalance(asset: GoalDepositAsset) {
  return parseBalance(asset.balance);
}

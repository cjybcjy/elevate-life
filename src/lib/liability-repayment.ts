export interface RepaymentAsset {
  id: string;
  name: string;
  category?: string | null;
  balance?: string | number | null;
  currency?: string | null;
}

export interface RepaymentSuggestion {
  amount: number;
  label: string;
}

const REPAYMENT_SOURCE_CATEGORIES = new Set(['cash', 'current_deposit']);

function parseMoney(value: string | number | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value || '0');
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function getRepaymentSourceOptions(assets: RepaymentAsset[]) {
  return assets
    .filter((asset) => (
      Boolean(asset.category && REPAYMENT_SOURCE_CATEGORIES.has(asset.category))
      && (asset.currency || 'CNY').toUpperCase() === 'CNY'
      && parseMoney(asset.balance) > 0
    ))
    .sort((left, right) => parseMoney(right.balance) - parseMoney(left.balance));
}

export function getDrawdownTargetOptions(assets: RepaymentAsset[]) {
  return assets
    .filter((asset) => (
      Boolean(asset.category && REPAYMENT_SOURCE_CATEGORIES.has(asset.category))
      && (asset.currency || 'CNY').toUpperCase() === 'CNY'
    ))
    .sort((left, right) => parseMoney(right.balance) - parseMoney(left.balance));
}

export function getRepaymentAssetBalance(asset: RepaymentAsset) {
  return parseMoney(asset.balance);
}

export function getRepaymentSuggestions({
  balance,
  monthlyPayment,
}: {
  balance: string | number;
  monthlyPayment?: string | number | null;
}): RepaymentSuggestion[] {
  const remainingBalance = parseMoney(balance);
  const monthly = parseMoney(monthlyPayment);
  if (remainingBalance <= 0) return [];

  const suggestions: RepaymentSuggestion[] = [];
  if (monthly > 0 && monthly <= remainingBalance) {
    suggestions.push({ amount: monthly, label: `本期 ¥${monthly.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}` });
  }

  for (const amount of [500, 1000, 3000]) {
    if (amount <= remainingBalance && !suggestions.some((suggestion) => suggestion.amount === amount)) {
      suggestions.push({ amount, label: `+¥${amount.toLocaleString('zh-CN')}` });
    }
  }

  if (remainingBalance < 500 && !suggestions.some((suggestion) => suggestion.amount === remainingBalance)) {
    suggestions.push({
      amount: remainingBalance,
      label: `结清 ¥${remainingBalance.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`,
    });
  }

  return suggestions;
}

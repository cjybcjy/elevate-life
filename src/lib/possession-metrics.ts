export type PossessionStatus = 'active' | 'idle' | 'sold' | 'retired';

export const POSSESSION_STATUS_LABELS: Record<PossessionStatus, string> = {
  active: '使用中',
  idle: '闲置',
  sold: '已出售',
  retired: '已退役',
};

export function normalizePossessionStatus(value: string): PossessionStatus {
  if (value === 'idle' || value === 'sold' || value === 'retired') return value;
  return 'active';
}

export function possessionHeldDays(
  purchaseDate: Date | string,
  endDate: Date | string | null | undefined,
  today: Date = new Date(),
) {
  const start = new Date(purchaseDate);
  const end = endDate ? new Date(endDate) : today;
  const elapsed = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(elapsed / 86_400_000) + 1);
}

export function possessionDailyCost(input: {
  purchasePrice: number;
  purchaseDate: Date | string;
  soldPrice?: number | null;
  soldDate?: Date | string | null;
  today?: Date;
}) {
  const days = possessionHeldDays(input.purchaseDate, input.soldDate, input.today);
  const realizedCost = Math.max(0, input.purchasePrice - (input.soldPrice ?? 0));
  return realizedCost / days;
}

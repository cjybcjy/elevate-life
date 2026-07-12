import type { LedgerAgentDraft } from '@/lib/ledger-agent';

export type LedgerCreateFormValues = {
  type: string;
  amount: string;
  currency: string;
  categoryId: string;
  budgetId: string;
  fromAccountId: string;
  toAccountId: string;
  description: string;
  occurredAt: string;
};

export function buildLedgerCreateFormValues(draft: LedgerAgentDraft): LedgerCreateFormValues {
  return {
    type: draft.type,
    amount: draft.amount,
    currency: draft.currency,
    categoryId: draft.categoryId,
    budgetId: '',
    fromAccountId: draft.fromAccountId,
    toAccountId: draft.toAccountId,
    description: draft.description,
    occurredAt: draft.occurredAt,
  };
}

type LedgerCacheKey = string | ((key: unknown) => boolean);

export async function refreshLedgerCaches(
  mutate: (key: LedgerCacheKey) => Promise<unknown>,
) {
  await Promise.allSettled([
    mutate('transactions'),
    mutate('assets'),
    mutate((key) => typeof key === 'string' && (key.startsWith('budgets') || key.startsWith('forecast'))),
  ]);
}

export async function withLedgerLoading<T>(
  setLoading: (loading: boolean) => void,
  work: () => Promise<T>,
) {
  setLoading(true);
  try {
    return await work();
  } finally {
    setLoading(false);
  }
}

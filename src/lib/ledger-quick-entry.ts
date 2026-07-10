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

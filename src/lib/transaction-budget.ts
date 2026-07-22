export type TransactionBudgetCandidate = { id: string };

export function selectTransactionBudgetId(input: {
  requestedBudgetId?: string;
  type: string;
  categoryId?: string;
  candidates: TransactionBudgetCandidate[];
}) {
  if (input.requestedBudgetId) return input.requestedBudgetId;
  if (input.type !== 'EXPENSE' || !input.categoryId) return undefined;
  return input.candidates.length === 1 ? input.candidates[0].id : undefined;
}

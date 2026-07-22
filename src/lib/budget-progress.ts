export interface BudgetExpenseMatchInput {
  id: string;
  categoryId: string | null;
  startDate: Date;
  endDate: Date;
}

export interface BudgetExpenseTransaction {
  budgetId: string | null;
  categoryId: string | null;
  occurredAt: Date;
}

export function budgetIncludesExpense(
  budget: BudgetExpenseMatchInput,
  transaction: BudgetExpenseTransaction,
) {
  if (transaction.occurredAt < budget.startDate || transaction.occurredAt > budget.endDate) {
    return false;
  }

  if (budget.categoryId === null) return true;
  if (transaction.budgetId === budget.id) return true;
  return transaction.budgetId === null && transaction.categoryId === budget.categoryId;
}

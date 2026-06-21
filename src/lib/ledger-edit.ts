type TransactionEditForm = {
  amount: string;
  categoryId: string;
  budgetId: string;
  fromAccountId: string;
  description: string;
  occurredAt: string;
};

export function buildTransactionUpdateInput(form: TransactionEditForm) {
  return {
    amount: form.amount || undefined,
    categoryId: form.categoryId || null,
    budgetId: form.budgetId || null,
    fromAccountId: form.fromAccountId || null,
    description: form.description,
    occurredAt: form.occurredAt || undefined,
  };
}

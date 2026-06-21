import assert from 'node:assert/strict';
import test from 'node:test';

type LedgerEditModule = {
  buildTransactionUpdateInput?: (form: {
    amount: string;
    categoryId: string;
    budgetId: string;
    fromAccountId: string;
    description: string;
    occurredAt: string;
  }) => {
    amount?: string;
    categoryId?: string | null;
    budgetId?: string | null;
    fromAccountId?: string | null;
    description?: string;
    occurredAt?: string;
  };
};

async function loadSubject(): Promise<LedgerEditModule> {
  return await import('./ledger-edit');
}

test('buildTransactionUpdateInput preserves explicit clears for nullable transaction fields', async () => {
  const { buildTransactionUpdateInput } = await loadSubject();
  assert.equal(typeof buildTransactionUpdateInput, 'function');
  const buildInput = buildTransactionUpdateInput as NonNullable<
    LedgerEditModule['buildTransactionUpdateInput']
  >;

  assert.deepEqual(
    buildInput({
      amount: '569.00',
      categoryId: '',
      budgetId: '',
      fromAccountId: '',
      description: '',
      occurredAt: '2026-06-19',
    }),
    {
      amount: '569.00',
      categoryId: null,
      budgetId: null,
      fromAccountId: null,
      description: '',
      occurredAt: '2026-06-19',
    },
  );
});

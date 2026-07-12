import assert from 'node:assert/strict';
import test from 'node:test';

type LedgerAgentModule = {
  buildLedgerAgentDraft?: (input: string, context: {
    today?: Date;
    categories?: Array<{ id: string; name: string; type?: string | null }>;
    assets?: Array<{ id: string; name: string }>;
  }) => {
    success: boolean;
    error?: string;
    draft?: {
      type: string;
      amount: string;
      currency: string;
      categoryId: string;
      fromAccountId: string;
      toAccountId: string;
      description: string;
      occurredAt: string;
      confidence: number;
      notes: string[];
    };
  };
};

async function loadSubject(): Promise<LedgerAgentModule> {
  try {
    return await import('./ledger-agent');
  } catch {
    return {};
  }
}

const context = {
  today: new Date('2026-07-08T12:00:00+08:00'),
  categories: [
    { id: 'cat-food', name: '餐饮', type: 'EXPENSE' },
    { id: 'cat-traffic', name: '交通', type: 'EXPENSE' },
    { id: 'cat-salary', name: '工资', type: 'INCOME' },
  ],
  assets: [
    { id: 'asset-cmb', name: '招商银行卡' },
    { id: 'asset-cash', name: '现金' },
  ],
};

test('buildLedgerAgentDraft turns a short expense sentence into a form-ready draft', async () => {
  const { buildLedgerAgentDraft } = await loadSubject();
  assert.equal(typeof buildLedgerAgentDraft, 'function');
  const buildDraft = buildLedgerAgentDraft as NonNullable<LedgerAgentModule['buildLedgerAgentDraft']>;

  const result = buildDraft('昨天午饭 32.5 用招行', context);

  assert.equal(result.success, true);
  assert.deepEqual(result.draft, {
    type: 'EXPENSE',
    amount: '32.5',
    currency: 'CNY',
    categoryId: 'cat-food',
    fromAccountId: 'asset-cmb',
    toAccountId: '',
    description: '昨天午饭 用招行',
    occurredAt: '2026-07-07',
    confidence: 0.86,
    notes: ['已识别金额、日期、分类和来源账户'],
  });
});

test('buildLedgerAgentDraft supports income and account target matching', async () => {
  const { buildLedgerAgentDraft } = await loadSubject();
  assert.equal(typeof buildLedgerAgentDraft, 'function');
  const buildDraft = buildLedgerAgentDraft as NonNullable<LedgerAgentModule['buildLedgerAgentDraft']>;

  const result = buildDraft('今天工资收入 18000 到招商银行卡', context);

  assert.equal(result.success, true);
  assert.equal(result.draft?.type, 'INCOME');
  assert.equal(result.draft?.amount, '18000');
  assert.equal(result.draft?.categoryId, 'cat-salary');
  assert.equal(result.draft?.fromAccountId, '');
  assert.equal(result.draft?.toAccountId, 'asset-cmb');
  assert.equal(result.draft?.occurredAt, '2026-07-08');
});

test('buildLedgerAgentDraft asks for an amount when none is present', async () => {
  const { buildLedgerAgentDraft } = await loadSubject();
  assert.equal(typeof buildLedgerAgentDraft, 'function');
  const buildDraft = buildLedgerAgentDraft as NonNullable<LedgerAgentModule['buildLedgerAgentDraft']>;

  const result = buildDraft('今天买咖啡', context);

  assert.deepEqual(result, {
    success: false,
    error: '还没识别到金额，请补一句类似“午饭 32 元”。',
  });
});

test('buildLedgerAgentDraft does not treat a short Chinese date as the amount', async () => {
  const { buildLedgerAgentDraft } = await loadSubject();
  assert.equal(typeof buildLedgerAgentDraft, 'function');
  const buildDraft = buildLedgerAgentDraft as NonNullable<LedgerAgentModule['buildLedgerAgentDraft']>;

  const result = buildDraft('7月8日地铁 6 用现金', context);

  assert.equal(result.success, true);
  assert.equal(result.draft?.occurredAt, '2026-07-08');
  assert.equal(result.draft?.amount, '6');
});

test('buildLedgerAgentDraft does not treat a full-year numeric date as the amount', async () => {
  const { buildLedgerAgentDraft } = await loadSubject();
  assert.equal(typeof buildLedgerAgentDraft, 'function');
  const buildDraft = buildLedgerAgentDraft as NonNullable<LedgerAgentModule['buildLedgerAgentDraft']>;

  for (const input of ['2026年7月8日地铁 6 用现金', '2026-07-08 地铁 6 用现金']) {
    const result = buildDraft(input, context);
    assert.equal(result.success, true, input);
    assert.equal(result.draft?.occurredAt, '2026-07-08', input);
    assert.equal(result.draft?.amount, '6', input);
  }
});

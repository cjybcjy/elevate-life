import assert from 'node:assert/strict';
import test from 'node:test';

type GoldAlertModule = {
  getGoldAlertDraftState?: (savedValue: string, draftValue: string) => {
    canSave: boolean;
    statusText: string;
    validationError: string | null;
    normalizedValue: string;
    willClear: boolean;
  };
};

async function loadSubject(): Promise<GoldAlertModule> {
  try {
    return await import('./gold-alert');
  } catch {
    return {};
  }
}

test('getGoldAlertDraftState requires an explicit save for changed gold alert values', async () => {
  const { getGoldAlertDraftState } = await loadSubject();
  assert.equal(typeof getGoldAlertDraftState, 'function');
  const getDraftState = getGoldAlertDraftState as NonNullable<
    GoldAlertModule['getGoldAlertDraftState']
  >;

  assert.deepEqual(getDraftState('', '628'), {
    canSave: true,
    statusText: '未保存',
    validationError: null,
    normalizedValue: '628',
    willClear: false,
  });
  assert.deepEqual(getDraftState('628', '628'), {
    canSave: false,
    statusText: '已保存',
    validationError: null,
    normalizedValue: '628',
    willClear: false,
  });
});

test('getGoldAlertDraftState reports invalid and clearable gold alert drafts', async () => {
  const { getGoldAlertDraftState } = await loadSubject();
  assert.equal(typeof getGoldAlertDraftState, 'function');
  const getDraftState = getGoldAlertDraftState as NonNullable<
    GoldAlertModule['getGoldAlertDraftState']
  >;

  assert.deepEqual(getDraftState('628', 'abc'), {
    canSave: false,
    statusText: '请输入大于 0 的价格',
    validationError: '请输入大于 0 的价格',
    normalizedValue: 'abc',
    willClear: false,
  });
  assert.deepEqual(getDraftState('628', '  '), {
    canSave: true,
    statusText: '待清除',
    validationError: null,
    normalizedValue: '',
    willClear: true,
  });
});

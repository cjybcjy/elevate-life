export const GOLD_ALERT_THRESHOLD_KEY = 'gold-price-alert-threshold';
export const GOLD_ALERT_THRESHOLD_CHANGED_EVENT = 'gold-price-alert-threshold-changed';

type GoldAlertDraftStatus = '未设置' | '已保存' | '未保存' | '待清除' | '请输入大于 0 的价格';

export type GoldAlertDraftState = {
  canSave: boolean;
  statusText: GoldAlertDraftStatus;
  validationError: string | null;
  normalizedValue: string;
  willClear: boolean;
};

function isPositiveDecimal(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export function parseGoldAlertThreshold(value: string) {
  const normalizedValue = value.trim();

  if (!isPositiveDecimal(normalizedValue)) {
    return null;
  }

  return Number(normalizedValue);
}

export function getGoldAlertDraftState(savedValue: string, draftValue: string): GoldAlertDraftState {
  const normalizedSavedValue = savedValue.trim();
  const normalizedValue = draftValue.trim();
  const changed = normalizedValue !== normalizedSavedValue;

  if (!changed) {
    return {
      canSave: false,
      statusText: normalizedSavedValue ? '已保存' : '未设置',
      validationError: null,
      normalizedValue,
      willClear: false,
    };
  }

  if (!normalizedValue) {
    return {
      canSave: true,
      statusText: '待清除',
      validationError: null,
      normalizedValue,
      willClear: true,
    };
  }

  if (!isPositiveDecimal(normalizedValue)) {
    return {
      canSave: false,
      statusText: '请输入大于 0 的价格',
      validationError: '请输入大于 0 的价格',
      normalizedValue,
      willClear: false,
    };
  }

  return {
    canSave: true,
    statusText: '未保存',
    validationError: null,
    normalizedValue,
    willClear: false,
  };
}

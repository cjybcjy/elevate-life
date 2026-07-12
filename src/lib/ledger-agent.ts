type LedgerAgentCategory = {
  id: string;
  name: string;
  type?: string | null;
};

type LedgerAgentAsset = {
  id: string;
  name: string;
};

export type LedgerAgentDraft = {
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

type LedgerAgentContext = {
  today?: Date;
  categories?: LedgerAgentCategory[];
  assets?: LedgerAgentAsset[];
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  餐饮: ['早餐', '早饭', '午饭', '晚饭', '餐', '饭', '咖啡', '奶茶', '外卖', '吃'],
  交通: ['地铁', '公交', '打车', '出租', '网约车', '高铁', '火车', '机票', '停车', '加油'],
  工资: ['工资', '薪水', '薪资', '奖金', '绩效'],
  购物: ['购物', '买', '淘宝', '京东', '拼多多', '衣服'],
  医疗: ['医院', '药', '体检', '门诊'],
  房租: ['房租', '租金', '物业', '水电', '燃气'],
};

const ASSET_ALIASES: Record<string, string> = {
  招行: '招商',
  工行: '工商',
  建行: '建设',
  农行: '农业',
  中行: '中国银行',
  交行: '交通银行',
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, '');
}

function formatDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const date = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${date}`;
}

function shiftDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDate(input: string, today: Date) {
  if (input.includes('前天')) return { value: formatDate(shiftDate(today, -2)), matched: true };
  if (input.includes('昨天')) return { value: formatDate(shiftDate(today, -1)), matched: true };
  if (input.includes('今天')) return { value: formatDate(today), matched: true };

  const fullDate = input.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (fullDate) {
    return {
      value: `${fullDate[1]}-${fullDate[2].padStart(2, '0')}-${fullDate[3].padStart(2, '0')}`,
      matched: true,
      index: fullDate.index,
      length: fullDate[0].length,
    };
  }

  const shortDate = input.match(/(?<!\d)(\d{1,2})[-/.月](\d{1,2})(?:日|号)?(?!\d)/);
  if (shortDate) {
    return {
      value: `${today.getFullYear()}-${shortDate[1].padStart(2, '0')}-${shortDate[2].padStart(2, '0')}`,
      matched: true,
      index: shortDate.index,
      length: shortDate[0].length,
    };
  }

  return { value: formatDate(today), matched: false };
}

function parseAmount(input: string, excluded?: { index?: number; length?: number }) {
  const searchable = excluded?.index !== undefined && excluded.length
    ? `${input.slice(0, excluded.index)}${' '.repeat(excluded.length)}${input.slice(excluded.index + excluded.length)}`
    : input;
  const amountMatch = searchable.match(/(?:人民币|rmb|cny|hk\$|港币|美元|美金|日元|jp¥|¥|\$)?\s*(\d+(?:\.\d{1,4})?)/i);
  if (!amountMatch) return null;

  const rawAmount = amountMatch[1].replace(/^0+(?=\d)/, '');
  return {
    amount: rawAmount || '0',
    index: amountMatch.index ?? 0,
    length: amountMatch[0].length,
  };
}

function parseCurrency(input: string) {
  if (/港币|港元|hk\$|hkd/i.test(input)) return 'HKD';
  if (/美元|美金|\busd\b|\$/i.test(input)) return 'USD';
  if (/日元|jpy|jp¥/i.test(input)) return 'JPY';
  return 'CNY';
}

function parseType(input: string) {
  if (/转账|转给|转到|转入|划转/.test(input)) return 'TRANSFER';
  if (/收入|工资|薪水|薪资|奖金|报销|到账/.test(input)) return 'INCOME';
  return 'EXPENSE';
}

function findCategory(input: string, type: string, categories: LedgerAgentCategory[]) {
  const normalizedInput = normalizeText(input);
  const compatible = categories.filter((category) => !category.type || category.type === type);

  const direct = compatible.find((category) => normalizedInput.includes(normalizeText(category.name)));
  if (direct) return direct;

  for (const category of compatible) {
    const categoryName = category.name;
    const directKeywords = CATEGORY_KEYWORDS[categoryName] ?? [];
    const fuzzyKeywords = Object.entries(CATEGORY_KEYWORDS)
      .filter(([key]) => categoryName.includes(key) || key.includes(categoryName))
      .flatMap(([, values]) => values);
    const keywords = [...directKeywords, ...fuzzyKeywords];

    if (keywords.some((keyword) => input.includes(keyword))) return category;
  }

  return null;
}

function findAsset(input: string, assets: LedgerAgentAsset[]) {
  const normalizedInput = normalizeText(input);

  return assets.find((asset) => {
    const normalizedName = normalizeText(asset.name);
    if (normalizedInput.includes(normalizedName) || normalizedName.includes(normalizedInput)) return true;

    return Object.entries(ASSET_ALIASES).some(([alias, fullName]) => (
      normalizedInput.includes(normalizeText(alias)) && normalizedName.includes(normalizeText(fullName))
    ));
  }) ?? null;
}

function buildDescription(input: string, amount: ReturnType<typeof parseAmount>) {
  if (!amount) return input.trim();
  const before = input.slice(0, amount.index);
  const after = input.slice(amount.index + amount.length);
  return `${before}${after}`
    .replace(/\b(CNY|RMB|HKD|USD|JPY)\b/gi, '')
    .replace(/[元块圆]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function confidenceScore(parts: {
  hasAmount: boolean;
  hasDate: boolean;
  hasCategory: boolean;
  hasAsset: boolean;
  hasType: boolean;
}) {
  const score =
    (parts.hasAmount ? 0.35 : 0) +
    (parts.hasDate ? 0.12 : 0) +
    (parts.hasCategory ? 0.18 : 0) +
    (parts.hasAsset ? 0.16 : 0) +
    (parts.hasType ? 0.05 : 0);

  return Number(score.toFixed(2));
}

function buildNotes(parts: {
  hasDate: boolean;
  category: LedgerAgentCategory | null;
  asset: LedgerAgentAsset | null;
  type: string;
}) {
  const recognized = ['金额'];
  if (parts.hasDate) recognized.push('日期');
  if (parts.category) recognized.push('分类');
  if (parts.asset) recognized.push(parts.type === 'INCOME' ? '目标账户' : '来源账户');

  if (recognized.length > 1) {
    const last = recognized[recognized.length - 1];
    return [`已识别${recognized.slice(0, -1).join('、')}和${last}`];
  }

  return ['已识别金额，请确认分类和资金账户'];
}

export function buildLedgerAgentDraft(input: string, context: LedgerAgentContext = {}) {
  const cleaned = input.trim();
  const today = context.today ?? new Date();
  const date = parseDate(cleaned, today);
  const amount = parseAmount(cleaned, date);

  if (!amount) {
    return {
      success: false,
      error: '还没识别到金额，请补一句类似“午饭 32 元”。',
    };
  }

  const type = parseType(cleaned);
  const category = findCategory(cleaned, type, context.categories ?? []);
  const asset = findAsset(cleaned, context.assets ?? []);
  const isIncome = type === 'INCOME';

  const draft: LedgerAgentDraft = {
    type,
    amount: amount.amount,
    currency: parseCurrency(cleaned),
    categoryId: category?.id ?? '',
    fromAccountId: isIncome ? '' : asset?.id ?? '',
    toAccountId: isIncome ? asset?.id ?? '' : '',
    description: buildDescription(cleaned, amount),
    occurredAt: date.value,
    confidence: confidenceScore({
      hasAmount: true,
      hasDate: date.matched,
      hasCategory: Boolean(category),
      hasAsset: Boolean(asset),
      hasType: true,
    }),
    notes: buildNotes({
      hasDate: date.matched,
      category,
      asset,
      type,
    }),
  };

  return { success: true, draft };
}

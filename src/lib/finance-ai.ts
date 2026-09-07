export type FinanceAiProvider = 'openai' | 'deepseek' | 'kimi' | 'minimax' | 'custom';

export type FinanceAiProviderPreset = {
  label: string;
  endpoint: string;
  model: string;
};

export type FinanceAiConfig = {
  provider: string;
  endpoint: string;
  apiKey: string;
  model: string;
};

export type FinanceAiMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type FinanceAiSnapshot = {
  currentDate: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  surplusRate: number;
  tier1Total: number;
  currentIncome: number;
  currentExpense: number;
  budgetRemaining: number;
  coverageMonths: number | null;
  overBudgetCount: number;
  missingSourceCount: number;
  pricesStale: boolean;
  goldUnitPrice: number | null;
  goldPriceCurrency: string | null;
  goldAlertThreshold?: number | null;
};

export type FinanceAiChatInput = {
  config: FinanceAiConfig;
  messages: FinanceAiMessage[];
  snapshot: FinanceAiSnapshot;
};

export class FinanceAiInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinanceAiInputError';
  }
}

export class FinanceAiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinanceAiProviderError';
  }
}

export const FINANCE_AI_PROVIDER_PRESETS: Record<Exclude<FinanceAiProvider, 'custom'>, FinanceAiProviderPreset> = {
  openai: {
    label: 'GPT / OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4.1-mini',
  },
  deepseek: {
    label: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
  },
  kimi: {
    label: 'Kimi / Moonshot',
    endpoint: 'https://api.moonshot.ai/v1/chat/completions',
    model: 'moonshot-v1-8k',
  },
  minimax: {
    label: 'MiniMax',
    endpoint: 'https://api.minimax.io/v1/chat/completions',
    model: 'MiniMax-M3',
  },
};

export const FINANCE_AI_CONFIG_STORAGE_KEY = 'finance-ai-chat-config-v1';
export const DEFAULT_FINANCE_AI_PROVIDER: Exclude<FinanceAiProvider, 'custom'> = 'deepseek';
export const DEFAULT_FINANCE_AI_CONFIG: FinanceAiConfig = {
  provider: DEFAULT_FINANCE_AI_PROVIDER,
  endpoint: FINANCE_AI_PROVIDER_PRESETS[DEFAULT_FINANCE_AI_PROVIDER].endpoint,
  apiKey: '',
  model: FINANCE_AI_PROVIDER_PRESETS[DEFAULT_FINANCE_AI_PROVIDER].model,
};

export function hasCompleteFinanceAiConfig(config: FinanceAiConfig) {
  return Boolean(config.endpoint.trim() && config.apiKey.trim() && config.model.trim());
}

function asRecord(value: unknown, message = '请求参数无效') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new FinanceAiInputError(message);
  }

  return value as Record<string, unknown>;
}

function readString(
  value: unknown,
  label: string,
  maxLength: number,
  options: { allowEmpty?: boolean; nullable?: boolean } = {},
) {
  if (options.nullable && value === null) return null;
  if (typeof value !== 'string') {
    throw new FinanceAiInputError(`${label}格式无效`);
  }

  const normalized = value.trim();
  if (!options.allowEmpty && !normalized) {
    throw new FinanceAiInputError(`${label}不能为空`);
  }
  if (normalized.length > maxLength) {
    throw new FinanceAiInputError(`${label}内容过长`);
  }

  return normalized;
}

function readFiniteNumber(value: unknown, label: string): number;
function readFiniteNumber(value: unknown, label: string, nullable: true): number | null;
function readFiniteNumber(value: unknown, label: string, nullable = false): number | null {
  if (nullable && value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e15) {
    throw new FinanceAiInputError(`${label}必须是有效数字`);
  }

  return value;
}

function readCount(value: unknown, label: string) {
  const number = readFiniteNumber(value, label);
  if (!Number.isInteger(number) || number < 0 || number > 1_000_000) {
    throw new FinanceAiInputError(`${label}必须是有效计数`);
  }

  return number;
}

function readBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') {
    throw new FinanceAiInputError(`${label}必须是布尔值`);
  }

  return value;
}

export function parseFinanceAiConfig(value: unknown): FinanceAiConfig {
  const config = asRecord(value, 'API 配置无效');

  return {
    provider: readString(config.provider, '服务商', 32, { allowEmpty: true }) as string,
    endpoint: readString(config.endpoint, 'API 地址', 2_048, { allowEmpty: true }) as string,
    apiKey: readString(config.apiKey, 'API 密钥', 2_048, { allowEmpty: true }) as string,
    model: readString(config.model, '模型名称', 128, { allowEmpty: true }) as string,
  };
}

export function parseFinanceAiChatInput(value: unknown): FinanceAiChatInput {
  const input = asRecord(value);
  const rawMessages = input.messages;
  const rawSnapshot = asRecord(input.snapshot, '财务摘要无效');

  if (!Array.isArray(rawMessages) || rawMessages.length > 8) {
    throw new FinanceAiInputError('对话记录无效或过长');
  }

  const messages = rawMessages.map((item): FinanceAiMessage => {
    const message = asRecord(item, '对话消息无效');
    if (message.role !== 'user' && message.role !== 'assistant') {
      throw new FinanceAiInputError('对话角色无效');
    }

    return {
      role: message.role,
      content: readString(message.content, '对话内容', 4_000, { allowEmpty: true }) as string,
    };
  });

  const goldAlertThreshold = rawSnapshot.goldAlertThreshold === undefined
    ? undefined
    : readFiniteNumber(rawSnapshot.goldAlertThreshold, '黄金低价提醒', true);

  return {
    config: parseFinanceAiConfig(input.config),
    messages,
    snapshot: {
      currentDate: readString(rawSnapshot.currentDate, '当前日期', 32) as string,
      netWorth: readFiniteNumber(rawSnapshot.netWorth, '净资产'),
      totalAssets: readFiniteNumber(rawSnapshot.totalAssets, '总资产'),
      totalLiabilities: readFiniteNumber(rawSnapshot.totalLiabilities, '总负债'),
      surplusRate: readFiniteNumber(rawSnapshot.surplusRate, '净资产率'),
      tier1Total: readFiniteNumber(rawSnapshot.tier1Total, '一级流动性'),
      currentIncome: readFiniteNumber(rawSnapshot.currentIncome, '本月收入'),
      currentExpense: readFiniteNumber(rawSnapshot.currentExpense, '本月支出'),
      budgetRemaining: readFiniteNumber(rawSnapshot.budgetRemaining, '预算剩余'),
      coverageMonths: readFiniteNumber(rawSnapshot.coverageMonths, '流动性覆盖月数', true),
      overBudgetCount: readCount(rawSnapshot.overBudgetCount, '超支预算数'),
      missingSourceCount: readCount(rawSnapshot.missingSourceCount, '缺少付款账户数'),
      pricesStale: readBoolean(rawSnapshot.pricesStale, '价格刷新状态'),
      goldUnitPrice: readFiniteNumber(rawSnapshot.goldUnitPrice, '黄金价格', true),
      goldPriceCurrency: readString(rawSnapshot.goldPriceCurrency, '黄金价格币种', 16, {
        nullable: true,
      }) as string | null,
      goldAlertThreshold,
    },
  };
}

function formatCny(value: number) {
  return value.toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
  });
}

function formatNullableNumber(value: number | null, suffix = '') {
  if (value === null || !Number.isFinite(value)) return '暂无';
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}${suffix}`;
}

export function normalizeFinanceAiEndpoint(endpoint: string) {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
}

export function buildFinanceAiSystemPrompt(snapshot: FinanceAiSnapshot) {
  const monthSurplus = snapshot.currentIncome - snapshot.currentExpense;

  return [
    '你是家庭财务状态组件内的 AI 财务助理。',
    '只基于用户提供的家庭财务摘要回答，语气直接、谨慎、可执行。',
    '优先分析资产配比、现金流、一级流动性、预算执行、负债压力和黄金价格提醒。',
    '不要编造账户明细；不确定时先说明需要补充哪些数据。',
    '回答应简洁，尽量给 2-4 条行动建议；这不是投资或法律建议。',
    '',
    `当前日期：${snapshot.currentDate}`,
    `净资产：${formatCny(snapshot.netWorth)}`,
    `总资产：${formatCny(snapshot.totalAssets)}`,
    `总负债：${formatCny(snapshot.totalLiabilities)}`,
    `净资产率：${snapshot.surplusRate.toFixed(1)}%`,
    `一级流动性：${formatCny(snapshot.tier1Total)}`,
    `一级流动性覆盖月数：${formatNullableNumber(snapshot.coverageMonths, '个月')}`,
    `本月收入：${formatCny(snapshot.currentIncome)}`,
    `本月支出：${formatCny(snapshot.currentExpense)}`,
    `本月结余：${formatCny(monthSurplus)}`,
    `预算剩余：${formatCny(snapshot.budgetRemaining)}`,
    `超支预算：${snapshot.overBudgetCount}`,
    `缺少付款账户的支出：${snapshot.missingSourceCount}`,
    `价格是否待刷新：${snapshot.pricesStale ? '是' : '否'}`,
    `黄金报价：${formatNullableNumber(snapshot.goldUnitPrice)} ${snapshot.goldPriceCurrency ?? 'CNY'}/克`,
    `黄金低价提醒：${formatNullableNumber(snapshot.goldAlertThreshold ?? null)} ${snapshot.goldPriceCurrency ?? 'CNY'}/克`,
  ].join('\n');
}

function validateFinanceAiInput(input: FinanceAiChatInput) {
  const hasMessage = input.messages.some((message) => message.content.trim());

  if (!hasCompleteFinanceAiConfig(input.config)) {
    throw new FinanceAiInputError('请先保存 API 配置');
  }

  if (!hasMessage) {
    throw new FinanceAiInputError('请输入要问的问题');
  }
}

function assertHttpsUrl(url: string) {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new FinanceAiInputError('API 地址格式无效');
  }

  if (parsed.protocol !== 'https:') {
    throw new FinanceAiInputError('AI API 地址必须使用 HTTPS');
  }
}

export function buildFinanceAiChatRequest(value: unknown) {
  const input = parseFinanceAiChatInput(value);
  validateFinanceAiInput(input);

  const url = normalizeFinanceAiEndpoint(input.config.endpoint);
  assertHttpsUrl(url);

  const messages = input.messages
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content)
    .slice(-8);

  return {
    url,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.config.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.config.model.trim(),
        messages: [
          { role: 'system', content: buildFinanceAiSystemPrompt(input.snapshot) },
          ...messages,
        ],
        temperature: 0.3,
        stream: false,
      }),
      redirect: 'error' as const,
    },
  };
}

function extractProviderError(data: unknown) {
  if (data && typeof data === 'object' && 'error' in data) {
    const error = (data as { error?: unknown }).error;
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') return message.slice(0, 500);
    }
    if (typeof error === 'string') return error.slice(0, 500);
  }

  return null;
}

function extractAssistantContent(data: unknown) {
  if (!data || typeof data !== 'object') return '';
  const choices = (data as { choices?: unknown }).choices;

  if (Array.isArray(choices)) {
    const firstChoice = choices[0];
    if (firstChoice && typeof firstChoice === 'object') {
      const message = (firstChoice as { message?: unknown }).message;
      if (message && typeof message === 'object') {
        const content = (message as { content?: unknown }).content;
        if (typeof content === 'string') return content.trim();
      }
    }
  }

  const outputText = (data as { output_text?: unknown }).output_text;
  return typeof outputText === 'string' ? outputText.trim() : '';
}

export async function sendFinanceAiChat(input: unknown, fetcher: typeof fetch = fetch) {
  const request = buildFinanceAiChatRequest(input);
  let response: Response;

  try {
    response = await fetcher(request.url, {
      ...request.init,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new FinanceAiProviderError('AI 服务暂时不可用，请稍后重试');
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new FinanceAiProviderError(extractProviderError(data) ?? `模型请求失败：${response.status}`);
  }

  const content = extractAssistantContent(data);
  if (!content) {
    throw new FinanceAiProviderError('模型没有返回可显示的回复');
  }

  return { content };
}

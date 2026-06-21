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
  const endpoint = input.config.endpoint.trim();
  const apiKey = input.config.apiKey.trim();
  const model = input.config.model.trim();
  const hasMessage = input.messages.some((message) => message.content.trim());

  if (!endpoint || !apiKey || !model) {
    throw new Error('请先保存 API 配置');
  }

  if (!hasMessage) {
    throw new Error('请输入要问的问题');
  }
}

function assertHttpUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('API 地址必须是 http 或 https');
  }
}

export function buildFinanceAiChatRequest(input: FinanceAiChatInput) {
  validateFinanceAiInput(input);

  const url = normalizeFinanceAiEndpoint(input.config.endpoint);
  assertHttpUrl(url);

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
    },
  };
}

function extractProviderError(data: unknown) {
  if (data && typeof data === 'object' && 'error' in data) {
    const error = (data as { error?: unknown }).error;
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
    if (typeof error === 'string') return error;
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

export async function sendFinanceAiChat(input: FinanceAiChatInput, fetcher: typeof fetch = fetch) {
  const request = buildFinanceAiChatRequest(input);
  const response = await fetcher(request.url, request.init);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(extractProviderError(data) ?? `模型请求失败：${response.status}`);
  }

  const content = extractAssistantContent(data);
  if (!content) {
    throw new Error('模型没有返回可显示的回复');
  }

  return { content };
}

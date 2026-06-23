import {
  hasCompleteFinanceAiConfig,
  normalizeFinanceAiEndpoint,
  type FinanceAiConfig,
} from './finance-ai';

export type SerenityStockHolding = {
  name: string;
  stockCode: string;
  market: string;
  quantity: number;
  unitPrice: number | null;
  priceCurrency: string;
  marketValue: number;
  marketValueCny: number;
  costValue: number;
  costValueCny: number;
  pnl: number;
  pnlCny: number;
  pnlRate: number | null;
  weight: number;
};

export type SerenityStockSnapshot = {
  currentDate: string;
  totalValueCny: number;
  totalCostCny: number;
  totalPnlCny: number;
  totalPnlRate: number | null;
  accountTotalCny: number | null;
  idleCashCny: number | null;
  pricesStale: boolean;
  holdings: SerenityStockHolding[];
};

export type SerenityStockConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type SerenityStockAnalysisInput = {
  config: FinanceAiConfig;
  snapshot: SerenityStockSnapshot;
  question?: string;
  messages?: SerenityStockConversationMessage[];
};

function formatNumber(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString('zh-CN', { maximumFractionDigits });
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '暂无';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatCurrency(value: number, currency = 'CNY') {
  return `${currency} ${formatNumber(value, 2)}`;
}

function buildHoldingsContext(snapshot: SerenityStockSnapshot) {
  const rows = snapshot.holdings.map((holding, index) => {
    const unitPrice = holding.unitPrice === null ? '暂无' : formatCurrency(holding.unitPrice, holding.priceCurrency);

    return [
      `${index + 1}. ${holding.name} (${holding.market}:${holding.stockCode})`,
      `数量 ${formatNumber(holding.quantity, 4)}`,
      `现价 ${unitPrice}`,
      `市值 ${formatCurrency(holding.marketValue, holding.priceCurrency)} / 折合 CNY ${formatNumber(holding.marketValueCny, 2)}`,
      `成本 ${formatCurrency(holding.costValue, holding.priceCurrency)} / 折合 CNY ${formatNumber(holding.costValueCny, 2)}`,
      `盈亏 ${formatCurrency(holding.pnl, holding.priceCurrency)} / 折合 CNY ${formatNumber(holding.pnlCny, 2)} (${formatPercent(holding.pnlRate)})`,
      `组合权重 ${holding.weight.toFixed(2)}%`,
    ].join('；');
  });

  return [
    `当前日期：${snapshot.currentDate}`,
    `股票市值折合 CNY：${formatNumber(snapshot.totalValueCny, 2)}`,
    `股票成本折合 CNY：${formatNumber(snapshot.totalCostCny, 2)}`,
    `股票盈亏折合 CNY：${formatNumber(snapshot.totalPnlCny, 2)} (${formatPercent(snapshot.totalPnlRate)})`,
    `账户总额折合 CNY：${snapshot.accountTotalCny === null ? '暂无' : formatNumber(snapshot.accountTotalCny, 2)}`,
    `股票账户闲置现金 CNY：${snapshot.idleCashCny === null ? '暂无' : formatNumber(snapshot.idleCashCny, 2)}`,
    `价格是否待刷新：${snapshot.pricesStale ? '是' : '否'}`,
    '',
    '持仓明细：',
    ...rows,
  ].join('\n');
}

export function buildSerenityStockSystemPrompt(snapshot: SerenityStockSnapshot) {
  return [
    '你是股票持仓组件内的 AI 投资研究助手，按照 serenity-skill 的方法论分析持有股票。',
    '核心方法：先排产业链层级，再排公司；找真实扩产约束、供应链卡点、证据强弱、反方条件和下一步核验路径。',
    '这只是研究支持。不要给买入、卖出、加仓、减仓等直接交易指令，不要承诺收益，不要输出目标价。',
    '你只能基于下面的持仓快照做初筛。不要编造实时新闻、财报、客户、订单、价格、市值、估值或引用来源。',
    '如果需要实时或来源支持，请明确标为“Needs checking”，并写出应查的 source path，例如 A 股年报/临时公告/互动易，港股 HKEX filings，美股 SEC filings/earnings transcripts。',
    '如果公司业务或产业链位置无法从名称和代码可靠判断，要降低置信度，并把“业务位置待确认”写清楚。',
    '每次追问都要先回应当前判断，再指出最关键的缺口，并把讨论继续推向产业链卡点、证据、估值压力或什么情况说明判断错了。',
    '如果用户只是想继续聊，最多问一个聚焦问题，不要一次抛出很多问题。',
    '输出中文，保持简洁。推荐结构：',
    '1. 先排产业链层级：说明当前持仓暴露在哪些层，哪些层更值得优先核验。',
    '2. 优先研究名单：用表格列出 标的 / 可能卡住的环节或业务位置 / 为什么排这里 / 证据强度 / 主要风险 / 下一步查什么。',
    '3. 组合风险：集中度、市场分布、价格待刷新、成本缺失、同一主题拥挤度。',
    '4. 什么情况说明判断错了：给出可验证的反方条件。',
    '',
    buildHoldingsContext(snapshot),
  ].join('\n');
}

function normalizeConversationMessages(messages: SerenityStockConversationMessage[] = []) {
  return messages
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => (message.role === 'user' || message.role === 'assistant') && message.content)
    .slice(-8);
}

function validateSerenityStockInput(input: SerenityStockAnalysisInput) {
  if (!hasCompleteFinanceAiConfig(input.config)) {
    throw new Error('请先保存 API 配置');
  }

  if (!input.snapshot.holdings.length) {
    throw new Error('暂无可分析的股票持仓');
  }
}

function assertHttpUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('API 地址必须是 http 或 https');
  }
}

export function buildSerenityStockAnalysisRequest(input: SerenityStockAnalysisInput) {
  validateSerenityStockInput(input);

  const url = normalizeFinanceAiEndpoint(input.config.endpoint);
  assertHttpUrl(url);
  const question = input.question?.trim() || '请用 Serenity 方法分析我的当前股票持仓，并按优先研究价值排序。';
  const conversationMessages = normalizeConversationMessages(input.messages);

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
          { role: 'system', content: buildSerenityStockSystemPrompt(input.snapshot) },
          ...conversationMessages,
          { role: 'user', content: question },
        ],
        temperature: 0.2,
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

export async function sendSerenityStockAnalysis(input: SerenityStockAnalysisInput, fetcher: typeof fetch = fetch) {
  const request = buildSerenityStockAnalysisRequest(input);
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

import assert from 'node:assert/strict';
import test from 'node:test';

type FinanceAiModule = {
  FINANCE_AI_PROVIDER_PRESETS?: Record<string, {
    label: string;
    endpoint: string;
    model: string;
  }>;
  buildFinanceAiChatRequest?: (input: {
    config: {
      provider: string;
      endpoint: string;
      apiKey: string;
      model: string;
    };
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    snapshot: {
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
    };
  }) => {
    url: string;
    init: {
      method: string;
      headers: Record<string, string>;
      body: string;
    };
  };
  sendFinanceAiChat?: (input: Parameters<NonNullable<FinanceAiModule['buildFinanceAiChatRequest']>>[0], fetcher: typeof fetch) => Promise<{
    content: string;
  }>;
};

async function loadSubject(): Promise<FinanceAiModule> {
  try {
    return await import('./finance-ai');
  } catch {
    return {};
  }
}

const snapshot = {
  currentDate: '2026-06-18',
  netWorth: 880000,
  totalAssets: 1280000,
  totalLiabilities: 400000,
  surplusRate: 68.75,
  tier1Total: 180000,
  currentIncome: 62800,
  currentExpense: 21000,
  budgetRemaining: 5600,
  coverageMonths: 8.57,
  overBudgetCount: 1,
  missingSourceCount: 2,
  pricesStale: false,
  goldUnitPrice: 628,
  goldPriceCurrency: 'CNY',
};

test('finance AI provider presets cover OpenAI-compatible GPT, DeepSeek, Kimi, and MiniMax', async () => {
  const { FINANCE_AI_PROVIDER_PRESETS } = await loadSubject();
  assert.equal(typeof FINANCE_AI_PROVIDER_PRESETS, 'object');
  const presets = FINANCE_AI_PROVIDER_PRESETS as NonNullable<FinanceAiModule['FINANCE_AI_PROVIDER_PRESETS']>;

  for (const provider of ['openai', 'deepseek', 'kimi', 'minimax']) {
    assert(presets[provider], `${provider} preset should exist`);
    assert.match(presets[provider].endpoint, /\/chat\/completions$/);
    assert(presets[provider].model.length > 0);
  }
});

test('buildFinanceAiChatRequest normalizes endpoints and includes financial context', async () => {
  const { buildFinanceAiChatRequest } = await loadSubject();
  assert.equal(typeof buildFinanceAiChatRequest, 'function');
  const buildRequest = buildFinanceAiChatRequest as NonNullable<
    FinanceAiModule['buildFinanceAiChatRequest']
  >;

  const request = buildRequest({
    config: {
      provider: 'deepseek',
      endpoint: 'https://api.deepseek.com',
      apiKey: 'sk-test',
      model: 'deepseek-chat',
    },
    messages: [{ role: 'user', content: '我的资产配比哪里偏了？' }],
    snapshot,
  });

  assert.equal(request.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers.Authorization, 'Bearer sk-test');
  const body = JSON.parse(request.init.body);
  assert.equal(body.model, 'deepseek-chat');
  assert.equal(body.messages[0].role, 'system');
  assert(body.messages[0].content.includes('净资产：880,000'));
  assert(body.messages[0].content.includes('一级流动性：180,000'));
  assert(body.messages[0].content.includes('超支预算：1'));
  assert.equal(body.messages[1].content, '我的资产配比哪里偏了？');
});

test('sendFinanceAiChat extracts the assistant reply from an OpenAI-compatible response', async () => {
  const { sendFinanceAiChat } = await loadSubject();
  assert.equal(typeof sendFinanceAiChat, 'function');
  const sendChat = sendFinanceAiChat as NonNullable<FinanceAiModule['sendFinanceAiChat']>;

  const result = await sendChat(
    {
      config: {
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
        model: 'gpt-4.1-mini',
      },
      messages: [{ role: 'user', content: '流动性够吗？' }],
      snapshot,
    },
    async () => new Response(JSON.stringify({
      choices: [{ message: { content: '一级流动性覆盖 8.6 个月，短期够用。' } }],
    }), { status: 200 }),
  );

  assert.deepEqual(result, { content: '一级流动性覆盖 8.6 个月，短期够用。' });
});

test('buildFinanceAiChatRequest rejects incomplete manual API configuration', async () => {
  const { buildFinanceAiChatRequest } = await loadSubject();
  assert.equal(typeof buildFinanceAiChatRequest, 'function');
  const buildRequest = buildFinanceAiChatRequest as NonNullable<
    FinanceAiModule['buildFinanceAiChatRequest']
  >;

  assert.throws(
    () => buildRequest({
      config: { provider: 'openai', endpoint: '', apiKey: '', model: '' },
      messages: [{ role: 'user', content: '你好' }],
      snapshot,
    }),
    /请先保存 API 配置/,
  );
});

test('finance AI input rejects insecure endpoints and oversized conversation data', async () => {
  const { buildFinanceAiChatRequest } = await loadSubject();
  assert.equal(typeof buildFinanceAiChatRequest, 'function');
  const buildRequest = buildFinanceAiChatRequest as NonNullable<
    FinanceAiModule['buildFinanceAiChatRequest']
  >;

  assert.throws(
    () => buildRequest({
      config: {
        provider: 'custom',
        endpoint: 'http://127.0.0.1:3000',
        apiKey: 'sk-test',
        model: 'test',
      },
      messages: [{ role: 'user', content: '你好' }],
      snapshot,
    }),
    /HTTPS/,
  );

  assert.throws(
    () => buildRequest({
      config: {
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
        model: 'gpt-4.1-mini',
      },
      messages: Array.from({ length: 9 }, () => ({ role: 'user' as const, content: '你好' })),
      snapshot,
    }),
    /对话记录无效或过长/,
  );
});

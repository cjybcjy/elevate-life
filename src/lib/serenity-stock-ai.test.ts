import assert from 'node:assert/strict';
import test from 'node:test';

type SerenityStockAiModule = {
  buildSerenityStockAnalysisRequest?: (input: {
    config: {
      provider: string;
      endpoint: string;
      apiKey: string;
      model: string;
    };
    snapshot: any;
    question?: string;
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }) => {
    url: string;
    init: {
      method: string;
      headers: Record<string, string>;
      body: string;
    };
  };
  sendSerenityStockAnalysis?: (
    input: Parameters<NonNullable<SerenityStockAiModule['buildSerenityStockAnalysisRequest']>>[0],
    fetcher: typeof fetch,
  ) => Promise<{ content: string }>;
};

async function loadSubject(): Promise<SerenityStockAiModule> {
  try {
    return await import('./serenity-stock-ai');
  } catch {
    return {};
  }
}

const snapshot = {
  currentDate: '2026-06-22',
  totalValueCny: 260000,
  totalCostCny: 240000,
  totalPnlCny: 20000,
  totalPnlRate: 8.33,
  accountTotalCny: 300000,
  idleCashCny: 40000,
  pricesStale: true,
  holdings: [
    {
      name: '贵州茅台',
      stockCode: '600519',
      market: 'cn',
      quantity: 500,
      unitPrice: 520,
      priceCurrency: 'CNY',
      marketValue: 260000,
      marketValueCny: 260000,
      costValue: 240000,
      costValueCny: 240000,
      pnl: 20000,
      pnlCny: 20000,
      pnlRate: 8.33,
      weight: 100,
    },
  ],
};

test('buildSerenityStockAnalysisRequest creates a Serenity-style stock analysis request', async () => {
  const { buildSerenityStockAnalysisRequest } = await loadSubject();
  assert.equal(typeof buildSerenityStockAnalysisRequest, 'function');
  const buildRequest = buildSerenityStockAnalysisRequest as NonNullable<
    SerenityStockAiModule['buildSerenityStockAnalysisRequest']
  >;

  const request = buildRequest({
    config: {
      provider: 'deepseek',
      endpoint: 'https://api.deepseek.com',
      apiKey: 'sk-test',
      model: 'deepseek-chat',
    },
    snapshot,
  });

  assert.equal(request.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers.Authorization, 'Bearer sk-test');

  const body = JSON.parse(request.init.body);
  assert.equal(body.model, 'deepseek-chat');
  assert.equal(body.temperature, 0.2);
  assert.equal(body.messages[0].role, 'system');
  assert.match(body.messages[0].content, /serenity-skill/);
  assert.match(body.messages[0].content, /先排产业链层级/);
  assert.match(body.messages[0].content, /不要给买入、卖出、加仓、减仓/);
  assert.match(body.messages[0].content, /Needs checking/);
  assert.match(body.messages[0].content, /贵州茅台 \(cn:600519\)/);
  assert.match(body.messages[0].content, /价格是否待刷新：是/);
  assert.equal(body.messages[1].role, 'user');
  assert.match(body.messages[1].content, /优先研究价值/);
});

test('sendSerenityStockAnalysis extracts the assistant reply', async () => {
  const { sendSerenityStockAnalysis } = await loadSubject();
  assert.equal(typeof sendSerenityStockAnalysis, 'function');
  const sendAnalysis = sendSerenityStockAnalysis as NonNullable<
    SerenityStockAiModule['sendSerenityStockAnalysis']
  >;

  const result = await sendAnalysis(
    {
      config: {
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
        model: 'gpt-4.1-mini',
      },
      snapshot,
    },
    async () => new Response(JSON.stringify({
      choices: [{ message: { content: '先排产业链层级，再查公司证据。' } }],
    }), { status: 200 }),
  );

  assert.deepEqual(result, { content: '先排产业链层级，再查公司证据。' });
});

test('buildSerenityStockAnalysisRequest includes prior conversation for follow-up questions', async () => {
  const { buildSerenityStockAnalysisRequest } = await loadSubject();
  assert.equal(typeof buildSerenityStockAnalysisRequest, 'function');
  const buildRequest = buildSerenityStockAnalysisRequest as NonNullable<
    SerenityStockAiModule['buildSerenityStockAnalysisRequest']
  >;

  const request = buildRequest({
    config: {
      provider: 'deepseek',
      endpoint: 'https://api.deepseek.com',
      apiKey: 'sk-test',
      model: 'deepseek-chat',
    },
    snapshot,
    messages: [
      { role: 'assistant', content: '初筛：先查收入结构和客户验证。' },
      { role: 'user', content: '茅台的证据弱在哪里？' },
    ],
    question: '下一步先查什么？',
  });

  const body = JSON.parse(request.init.body);
  assert.match(body.messages[0].content, /每次追问/);
  assert.deepEqual(
    body.messages.slice(1).map((message: { role: string; content: string }) => message.role),
    ['assistant', 'user', 'user'],
  );
  assert.equal(body.messages[1].content, '初筛：先查收入结构和客户验证。');
  assert.equal(body.messages[2].content, '茅台的证据弱在哪里？');
  assert.equal(body.messages[3].content, '下一步先查什么？');
});

test('buildSerenityStockAnalysisRequest rejects missing provider configuration', async () => {
  const { buildSerenityStockAnalysisRequest } = await loadSubject();
  assert.equal(typeof buildSerenityStockAnalysisRequest, 'function');
  const buildRequest = buildSerenityStockAnalysisRequest as NonNullable<
    SerenityStockAiModule['buildSerenityStockAnalysisRequest']
  >;

  assert.throws(
    () => buildRequest({
      config: { provider: 'openai', endpoint: '', apiKey: '', model: '' },
      snapshot,
    }),
    /请先保存 API 配置/,
  );
});

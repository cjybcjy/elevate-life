'use client';

import { useState } from 'react';
import { createTransaction } from '@/lib/actions/ledger';
import {
  DEFAULT_FINANCE_AI_CONFIG,
  FINANCE_AI_PROVIDER_PRESETS,
  FINANCE_AI_CONFIG_STORAGE_KEY,
  hasCompleteFinanceAiConfig,
  type FinanceAiConfig,
  type FinanceAiMessage,
  type FinanceAiProvider,
  type FinanceAiSnapshot,
} from '@/lib/finance-ai';
import { useSWRConfig } from 'swr';
import LedgerAgentQuickEntry from './LedgerAgentQuickEntry';
import type { LedgerAgentDraft } from '@/lib/ledger-agent';

const quickQuestions = [
  '我的资产配比哪里偏了？',
  '一级流动性够覆盖几个月？',
  '本月预算应该先调整哪一项？',
];

type LedgerAgentContext = {
  categories: Array<{ id: string; name: string; type?: string | null }>;
  assets: Array<{ id: string; name: string }>;
};

function readStoredConfig() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(FINANCE_AI_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FinanceAiConfig>;

    return {
      provider: parsed.provider || DEFAULT_FINANCE_AI_CONFIG.provider,
      endpoint: parsed.endpoint || DEFAULT_FINANCE_AI_CONFIG.endpoint,
      apiKey: parsed.apiKey || '',
      model: parsed.model || DEFAULT_FINANCE_AI_CONFIG.model,
    };
  } catch {
    return null;
  }
}

function storeConfig(config: FinanceAiConfig) {
  localStorage.setItem(FINANCE_AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function ledgerDraftSummary(draft: LedgerAgentDraft, context: LedgerAgentContext) {
  const typeLabel = draft.type === 'INCOME' ? '收入' : draft.type === 'TRANSFER' ? '转账' : '支出';
  const category = context.categories.find((item) => item.id === draft.categoryId)?.name ?? '未指定分类';
  const accountId = draft.type === 'INCOME' ? draft.toAccountId : draft.fromAccountId;
  const account = context.assets.find((item) => item.id === accountId)?.name ?? '未指定账户';
  return `${typeLabel} ${draft.currency} ${draft.amount} · ${category} · ${account} · ${draft.occurredAt}`;
}

export default function FinancialAiChat({
  snapshot,
  ledgerAgentContext,
}: {
  snapshot: FinanceAiSnapshot;
  ledgerAgentContext?: LedgerAgentContext;
}) {
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<FinanceAiConfig>(() => readStoredConfig() ?? DEFAULT_FINANCE_AI_CONFIG);
  const [messages, setMessages] = useState<FinanceAiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [ledgerDraft, setLedgerDraft] = useState<LedgerAgentDraft | null>(null);
  const [ledgerStatus, setLedgerStatus] = useState('');
  const [ledgerLoading, setLedgerLoading] = useState(false);
  function openChat() {
    setOpen(true);
  }

  function handleProviderChange(provider: FinanceAiProvider) {
    const preset = provider === 'custom' ? null : FINANCE_AI_PROVIDER_PRESETS[provider];

    setConfig((current) => ({
      ...current,
      provider,
      endpoint: preset?.endpoint ?? current.endpoint,
      model: preset?.model ?? current.model,
    }));
    setStatus('');
  }

  function handleSaveConfig() {
    try {
      storeConfig(config);
      setStatus('配置已保存');
      setShowSettings(false);
    } catch {
      setStatus('配置保存失败');
    }
  }

  async function sendMessage(content = draft) {
    const question = content.trim();
    if (!question || loading) return;

    if (!hasCompleteFinanceAiConfig(config)) {
      setStatus('请先保存 API 配置');
      setShowSettings(true);
      return;
    }

    const nextMessages: FinanceAiMessage[] = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);
    setDraft('');
    setStatus('');
    setLoading(true);

    try {
      const response = await fetch('/api/finance-ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, messages: nextMessages, snapshot }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'AI 请求失败');
      }

      setMessages([...nextMessages, { role: 'assistant', content: result.content }]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'AI 请求失败');
    } finally {
      setLoading(false);
    }
  }

  async function confirmLedgerDraft() {
    if (!ledgerDraft || ledgerLoading) return;

    setLedgerStatus('');
    setLedgerLoading(true);

    const result = await createTransaction({
      type: ledgerDraft.type,
      amount: ledgerDraft.amount,
      currency: ledgerDraft.currency,
      categoryId: ledgerDraft.categoryId || undefined,
      fromAccountId: ledgerDraft.fromAccountId || undefined,
      toAccountId: ledgerDraft.toAccountId || undefined,
      description: ledgerDraft.description || undefined,
      occurredAt: ledgerDraft.occurredAt,
    });

    if (result.success) {
      setLedgerDraft(null);
      setLedgerStatus('已记账');
      mutate('transactions');
      mutate('assets');
      mutate((key) => typeof key === 'string' && (key.startsWith('budgets') || key.startsWith('forecast')));
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      setLedgerStatus(result.error || '记账失败');
    }

    setLedgerLoading(false);
  }

  return (
    <div
      className="financial-ai-chat"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
      }}
    >
      {open && (
        <section
          aria-label="AI 财务聊天"
          style={{
            width: 'min(390px, 100%)',
            maxHeight: 'min(620px, calc(100vh - 120px))',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            background: 'var(--color-container)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '10px 12px',
              borderBottom: '1px solid var(--border-tertiary)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-primary)' }}>AI 财务助理</div>
              <div style={{ marginTop: 2, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                {FINANCE_AI_PROVIDER_PRESETS[config.provider as Exclude<FinanceAiProvider, 'custom'>]?.label ?? '自定义模型'} · {config.model || '未选模型'}
              </div>
            </div>
            <div style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setShowSettings((value) => !value)}
                className="btn btn-outline btn-sm"
                aria-label="配置 AI API"
              >
                配置
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-ghost btn-sm"
                aria-label="关闭 AI 聊天"
              >
                关闭
              </button>
            </div>
          </header>

          {showSettings && (
            <div
              style={{
                display: 'grid',
                gap: 8,
                padding: 12,
                borderBottom: '1px solid var(--border-tertiary)',
                background: 'var(--color-container-inset)',
              }}
            >
              <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                <span>Provider</span>
                <select
                  value={config.provider}
                  onChange={(event) => handleProviderChange(event.target.value as FinanceAiProvider)}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    background: 'var(--color-container)',
                    color: 'var(--color-text-primary)',
                    padding: '7px 8px',
                    fontSize: 12,
                  }}
                >
                  {Object.entries(FINANCE_AI_PROVIDER_PRESETS).map(([key, preset]) => (
                    <option key={key} value={key}>{preset.label}</option>
                  ))}
                  <option value="custom">自定义</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                <span>API 地址</span>
                <input
                  value={config.endpoint}
                  onChange={(event) => setConfig((current) => ({ ...current, endpoint: event.target.value }))}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    background: 'var(--color-container)',
                    color: 'var(--color-text-primary)',
                    padding: '7px 8px',
                    fontSize: 12,
                  }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  <span>模型</span>
                  <input
                    value={config.model}
                    onChange={(event) => setConfig((current) => ({ ...current, model: event.target.value }))}
                    style={{
                      minWidth: 0,
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      background: 'var(--color-container)',
                      color: 'var(--color-text-primary)',
                      padding: '7px 8px',
                      fontSize: 12,
                    }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  <span>API Key</span>
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={(event) => setConfig((current) => ({ ...current, apiKey: event.target.value }))}
                    autoComplete="off"
                    style={{
                      minWidth: 0,
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      background: 'var(--color-container)',
                      color: 'var(--color-text-primary)',
                      padding: '7px 8px',
                      fontSize: 12,
                    }}
                  />
                </label>
              </div>
              <button type="button" onClick={handleSaveConfig} className="btn btn-primary btn-sm">
                保存配置
              </button>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              minHeight: 190,
              overflowY: 'auto',
              padding: 12,
            }}
          >
            {ledgerAgentContext && (
              <div
                style={{
                  display: 'grid',
                  gap: 8,
                  paddingBottom: 10,
                  borderBottom: '1px solid var(--border-tertiary)',
                }}
              >
                <LedgerAgentQuickEntry
                  categories={ledgerAgentContext.categories}
                  assets={ledgerAgentContext.assets}
                  onApply={(nextDraft) => {
                    setLedgerDraft(nextDraft);
                    setLedgerStatus('请确认后记账');
                  }}
                />
                {ledgerDraft && (
                  <div
                    style={{
                      display: 'grid',
                      gap: 8,
                      border: '1px solid var(--border-tertiary)',
                      borderRadius: 8,
                      background: 'var(--color-container-inset)',
                      padding: 10,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-secondary)' }}>
                      待确认草稿
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--color-text-primary)' }}>
                      {ledgerDraftSummary(ledgerDraft, ledgerAgentContext)}
                    </div>
                    {ledgerDraft.description && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                        备注：{ledgerDraft.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setLedgerDraft(null);
                          setLedgerStatus('');
                        }}
                        className="btn btn-outline btn-sm"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={confirmLedgerDraft}
                        disabled={ledgerLoading}
                        className="btn btn-primary btn-sm"
                      >
                        {ledgerLoading ? '记账中...' : '确认记账'}
                      </button>
                    </div>
                  </div>
                )}
                {ledgerStatus && (
                  <div
                    aria-live="polite"
                    style={{
                      fontSize: 11,
                      color: ledgerStatus === '已记账' ? 'var(--color-success)' : ledgerStatus === '请确认后记账' ? 'var(--color-text-secondary)' : 'var(--color-danger)',
                    }}
                  >
                    {ledgerStatus}
                  </div>
                )}
              </div>
            )}

            {messages.length === 0 ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {quickQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => sendMessage(question)}
                    className="btn btn-outline btn-sm"
                    style={{ justifyContent: 'flex-start', whiteSpace: 'normal', lineHeight: 1.45 }}
                  >
                    {question}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  style={{
                    alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                    borderRadius: 8,
                    border: '1px solid var(--border-tertiary)',
                    background: message.role === 'user' ? 'var(--color-accent)' : 'var(--color-container-inset)',
                    color: message.role === 'user' ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
                    padding: '8px 10px',
                    fontSize: 12,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {message.content}
                </div>
              ))
            )}
            {loading && (
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>思考中...</div>
            )}
          </div>

          {status && (
            <div
              aria-live="polite"
              style={{
                padding: '0 12px 8px',
                fontSize: 11,
                color: status === '配置已保存' ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              {status}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 8,
              padding: 12,
              borderTop: '1px solid var(--border-tertiary)',
            }}
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="问资产配比、现金流、预算..."
              rows={2}
              style={{
                resize: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                background: 'var(--color-container-inset)',
                color: 'var(--color-text-primary)',
                padding: '8px 9px',
                fontSize: 12,
                lineHeight: 1.45,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!draft.trim() || loading}
              className="btn btn-primary btn-sm"
              style={{ alignSelf: 'end', minHeight: 38 }}
            >
              发送
            </button>
          </form>
        </section>
      )}

      {!open && (
        <button
          type="button"
          onClick={openChat}
          aria-label="打开 AI 财务聊天"
          style={{
            width: 78,
            height: 44,
            borderRadius: 999,
            border: '1px solid var(--color-accent)',
            background: 'var(--color-accent)',
            color: 'var(--color-text-inverse)',
            boxShadow: 'var(--shadow-lg)',
            fontSize: 13,
            fontWeight: 900,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          AI 助手
        </button>
      )}
    </div>
  );
}

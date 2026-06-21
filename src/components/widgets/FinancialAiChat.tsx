'use client';

import { useMemo, useState } from 'react';
import {
  FINANCE_AI_PROVIDER_PRESETS,
  type FinanceAiConfig,
  type FinanceAiMessage,
  type FinanceAiProvider,
  type FinanceAiSnapshot,
} from '@/lib/finance-ai';

const CONFIG_STORAGE_KEY = 'finance-ai-chat-config-v1';
const DEFAULT_PROVIDER: Exclude<FinanceAiProvider, 'custom'> = 'deepseek';

const defaultConfig: FinanceAiConfig = {
  provider: DEFAULT_PROVIDER,
  endpoint: FINANCE_AI_PROVIDER_PRESETS[DEFAULT_PROVIDER].endpoint,
  apiKey: '',
  model: FINANCE_AI_PROVIDER_PRESETS[DEFAULT_PROVIDER].model,
};

const quickQuestions = [
  '我的资产配比哪里偏了？',
  '一级流动性够覆盖几个月？',
  '本月预算应该先调整哪一项？',
];

function readStoredConfig() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FinanceAiConfig>;

    return {
      provider: parsed.provider || defaultConfig.provider,
      endpoint: parsed.endpoint || defaultConfig.endpoint,
      apiKey: parsed.apiKey || '',
      model: parsed.model || defaultConfig.model,
    };
  } catch {
    return null;
  }
}

function storeConfig(config: FinanceAiConfig) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function hasCompleteConfig(config: FinanceAiConfig) {
  return Boolean(config.endpoint.trim() && config.apiKey.trim() && config.model.trim());
}

export default function FinancialAiChat({ snapshot }: { snapshot: FinanceAiSnapshot }) {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<FinanceAiConfig>(() => readStoredConfig() ?? defaultConfig);
  const [messages, setMessages] = useState<FinanceAiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const configComplete = useMemo(() => hasCompleteConfig(config), [config]);

  function openChat() {
    setOpen(true);
    setShowSettings(!configComplete);
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

    if (!hasCompleteConfig(config)) {
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

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
      }}
    >
      {open && (
        <section
          aria-label="AI 财务聊天"
          style={{
            width: 'min(390px, calc(100vw - 32px))',
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

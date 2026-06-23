import type { FormEvent } from 'react';
import MarkdownContent from '@/components/common/MarkdownContent';

export type SerenityAnalysisMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type SerenityAnalysisPanelProps = {
  providerLabel: string;
  messages: SerenityAnalysisMessage[];
  status: string;
  loading: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export default function SerenityAnalysisPanel({
  providerLabel,
  messages,
  status,
  loading,
  draft,
  onDraftChange,
  onSubmit,
  onClose,
}: SerenityAnalysisPanelProps) {
  const hasMessages = messages.length > 0;

  return (
    <section
      className="mb-3 rounded-md border border-ledger-primary/10 bg-ledger-bg/60 p-3"
      aria-label="Serenity 持仓分析结果"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">Serenity 持仓分析</div>
          <div className="mt-1 text-xs text-ledger-muted">{providerLabel} · 研究支持，买卖动作由你决定</div>
        </div>
        {(hasMessages || status) && (
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm shrink-0"
          >
            收起
          </button>
        )}
      </div>

      <div className="mt-3 space-y-3 text-sm leading-6">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={message.role === 'user' ? 'flex justify-end' : undefined}
          >
            {message.role === 'user' ? (
              <div className="max-w-[88%] rounded-md bg-ledger-primary px-3 py-2 text-[var(--color-text-inverse)]">
                {message.content}
              </div>
            ) : (
              <div className="rounded-md border border-ledger-primary/5 bg-ledger-surface/70 p-3">
                <MarkdownContent content={message.content} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="text-ledger-muted">
            {hasMessages ? '继续分析中...' : '正在按产业链层级和卡点梳理持仓...'}
          </div>
        )}

        {status && (
          <div className="text-xs text-ledger-danger">{status}</div>
        )}
      </div>

      {hasMessages && (
        <form onSubmit={onSubmit} className="mt-3 border-t border-ledger-primary/10 pt-3">
          <div className="mb-2 text-xs font-medium text-ledger-muted">继续追问</div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              rows={2}
              aria-label="继续追问 Serenity 分析"
              placeholder="问证据、风险、下一步核验..."
              className="min-h-16 resize-none rounded-md border border-ledger-primary/10 bg-ledger-surface px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-ledger-muted/60 focus:border-ledger-accent"
            />
            <button
              type="submit"
              disabled={!draft.trim() || loading}
              className="btn btn-primary btn-sm self-end"
            >
              发送
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

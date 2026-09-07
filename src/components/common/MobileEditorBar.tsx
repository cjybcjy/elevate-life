'use client';

import { useEffect } from 'react';

export const mobileEditorControlClass =
  'min-h-11 w-full min-w-0 rounded-lg border border-[var(--border-tertiary)] bg-ledger-surface px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-ledger-accent focus:outline-none';

export function useMobileEditorScroll(editorId: string | null) {
  useEffect(() => {
    if (!editorId || !window.matchMedia('(max-width: 767px)').matches) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(editorId)?.scrollIntoView({
        block: 'start',
        behavior: 'smooth',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [editorId]);
}

export function MobileEditorBar({
  title,
  description = '修改完成后保存',
  onCancel,
  onSave,
  formId,
  saveLabel = '保存',
  saving = false,
  saveDisabled = false,
}: {
  title: string;
  description?: string;
  onCancel: () => void;
  onSave?: () => void;
  formId?: string;
  saveLabel?: string;
  saving?: boolean;
  saveDisabled?: boolean;
}) {
  return (
    <div className="sticky top-[calc(64px+env(safe-area-inset-top))] z-20 mb-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border-secondary)] bg-ledger-surface/95 p-2 shadow-[var(--shadow-sm)] backdrop-blur md:hidden">
      <div className="min-w-0 pl-1">
        <div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{title}</div>
        <div className="mt-0.5 truncate text-[11px] text-ledger-muted">{description}</div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="min-h-11 rounded-lg border border-[var(--border-tertiary)] px-3 text-sm text-[var(--color-text-primary)] disabled:opacity-50"
        >
          取消
        </button>
        <button
          type={formId ? 'submit' : 'button'}
          form={formId}
          onClick={onSave}
          disabled={saving || saveDisabled}
          className="min-h-11 rounded-lg bg-ledger-accent px-4 text-sm font-medium text-[var(--color-text-inverse)] disabled:opacity-50"
        >
          {saving ? '保存中…' : saveLabel}
        </button>
      </div>
    </div>
  );
}

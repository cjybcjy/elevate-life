'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type QuickEntryMoreSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export default function QuickEntryMoreSheet({
  open,
  title,
  onClose,
  children,
}: QuickEntryMoreSheetProps) {
  const panelRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusFrame = window.requestAnimationFrame(() => panelRef.current?.focus());
    const containKeyboardFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', containKeyboardFocus);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', containKeyboardFocus);
      previouslyFocusedRef.current?.focus();
      previouslyFocusedRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  const sheet = (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[90] border-0 bg-black/45 md:hidden"
        aria-label={`关闭${title}`}
        onClick={onClose}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-[100] max-h-[82dvh] overflow-y-auto rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-container)] p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-xl md:hidden"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
          <button
            type="button"
            aria-label={`关闭${title}`}
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-lg border border-[var(--border-tertiary)]"
          >
            关闭
          </button>
        </div>
        {children}
      </section>
    </>
  );

  return typeof document === 'undefined' ? sheet : createPortal(sheet, document.body);
}

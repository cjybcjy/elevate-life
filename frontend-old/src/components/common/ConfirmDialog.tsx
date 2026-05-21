interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmText = '删除' }: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-ledger-surface rounded-xl p-6 max-w-sm w-full mx-4 border border-ledger-primary/10">
        <h3 className="text-lg font-medium text-ledger-text mb-2">{title}</h3>
        <p className="text-ledger-muted text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-ledger-muted hover:text-ledger-text transition-colors rounded-lg"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

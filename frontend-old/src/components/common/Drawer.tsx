import { type ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-[420px] max-w-full bg-ledger-surface border-l border-ledger-primary/10 z-50 transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-ledger-primary/10">
          <h2 className="text-lg font-medium text-ledger-text">{title}</h2>
          <button
            onClick={onClose}
            className="text-ledger-muted hover:text-ledger-text transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="p-5 overflow-y-auto" style={{ height: 'calc(100% - 65px)' }}>
          {children}
        </div>
      </div>
    </>
  );
}

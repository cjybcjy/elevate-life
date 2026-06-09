import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

export function BreathingCard({ children, className = '' }: Props) {
  return (
    <div
      className={`bg-ledger-surface rounded-xl p-6 border border-ledger-primary/20 animate-breathe transition-transform duration-300 hover:scale-[1.02] ${className}`}
    >
      {children}
    </div>
  );
}

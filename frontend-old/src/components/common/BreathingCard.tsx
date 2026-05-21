import type { ReactNode } from 'react';

interface BreathingCardProps {
  children: ReactNode;
  className?: string;
}

export function BreathingCard({ children, className = '' }: BreathingCardProps) {
  return (
    <div
      className={`
        bg-ledger-surface rounded-xl p-6
        border border-ledger-primary/20
        animate-breathe
        transition-transform duration-300 hover:scale-[1.02]
        ${className}
      `}
    >
      {children}
    </div>
  );
}

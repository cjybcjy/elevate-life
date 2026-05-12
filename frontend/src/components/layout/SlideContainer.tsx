import type { ReactNode } from 'react';

interface SlideContainerProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function SlideContainer({ children, title, subtitle }: SlideContainerProps) {
  return (
    <div className="flex-1 flex flex-col p-8 animate-fade-in">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-ledger-text">{title}</h1>
        {subtitle && (
          <p className="text-ledger-muted mt-1">{subtitle}</p>
        )}
      </header>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

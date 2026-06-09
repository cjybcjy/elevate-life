'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Responsive } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import './dashboard-grid-overrides.css';

const STORAGE_KEY = 'dashboard-layout-v2';

const defaultLayouts = {
  lg: [
    { i: 'networth', x: 0, y: 0, w: 12, h: 2 },
    { i: 'assets', x: 0, y: 2, w: 6, h: 6 },
    { i: 'debts', x: 6, y: 2, w: 6, h: 6 },
    { i: 'strategy', x: 0, y: 8, w: 12, h: 2 },
    { i: 'stocks', x: 0, y: 10, w: 12, h: 6 },
    { i: 'budget', x: 0, y: 16, w: 6, h: 4 },
    { i: 'goals', x: 6, y: 16, w: 6, h: 4 },
    { i: 'scissor', x: 0, y: 20, w: 6, h: 5 },
    { i: 'forecast', x: 6, y: 20, w: 6, h: 5 },
  ],
};

const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const cols = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };

export default function DashboardGrid({ children }: { children: React.ReactNode[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [layouts, setLayouts] = useState(defaultLayouts);
  const [mounted, setMounted] = useState(false);

  // Measure container width for responsive grid
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => setContainerWidth(el.offsetWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setLayouts(JSON.parse(saved));
    } catch {}
    setMounted(true);
  }, []);

  const onLayoutChange = useCallback((layout: any, allLayouts: any) => {
    setLayouts(allLayouts);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(allLayouts)); } catch {}
  }, []);

  if (!mounted || !containerWidth) return (
    <div ref={containerRef} className="space-y-4">{children}</div>
  );

  const allKeys = ['networth', 'assets', 'debts', 'strategy', 'stocks', 'budget', 'goals', 'scissor', 'forecast'];
  const rawChildren = Array.isArray(children) ? children : [children];
  // Pair each child with its key, filter out falsy children
  const childWithKeys: { key: string; child: React.ReactNode }[] = [];
  for (let i = 0; i < Math.min(rawChildren.length, allKeys.length); i++) {
    if (rawChildren[i]) childWithKeys.push({ key: allKeys[i], child: rawChildren[i] });
  }
  const presentKeys = new Set(childWithKeys.map(c => c.key));

  // Filter layouts to only include present children
  const filteredLayouts: Record<string, any[]> = {};
  for (const bp of Object.keys(layouts)) {
    filteredLayouts[bp] = (layouts as any)[bp].filter((item: any) => presentKeys.has(item.i));
  }

  return (
    <div ref={containerRef}>
      <Responsive
        layouts={filteredLayouts}
        breakpoints={breakpoints}
        cols={cols}
        width={containerWidth}
        rowHeight={60}
        onLayoutChange={onLayoutChange}
        margin={[10, 10]}
        containerPadding={[16, 16]}
      >
        {childWithKeys.map(({ key, child }) => (
          <div key={key} className="bg-ledger-surface rounded-xl overflow-auto">
            {child}
          </div>
        ))}
      </Responsive>
    </div>
  );
}

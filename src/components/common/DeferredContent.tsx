'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export default function DeferredContent({
  children,
  fallback,
  minHeight,
}: {
  children: ReactNode;
  fallback: ReactNode;
  minHeight: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    if (!('IntersectionObserver' in window)) {
      const frame = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setReady(true);
      observer.disconnect();
    }, { rootMargin: '240px 0px' });

    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [ready]);

  return (
    <div
      ref={container}
      data-deferred-content={ready ? 'ready' : 'pending'}
      style={{ width: '100%', minWidth: 0, minHeight: ready ? undefined : minHeight }}
    >
      {ready ? children : fallback}
    </div>
  );
}

'use client';

import type { ComponentProps } from 'react';
import Link from 'next/link';
import { useNavigationReadiness } from '@/components/layout/NavigationReadinessProvider';
import NavigationPending from '@/components/layout/NavigationPending';

export default function NavigationLink({
  prefetch = true, pending = false, children, style, ...props
}: ComponentProps<typeof Link> & { pending?: boolean }) {
  const { ready } = useNavigationReadiness();
  return (
    <Link {...props} style={pending ? { position: 'relative', ...style } : style} prefetch={ready ? prefetch : false}>
      {children}
      {pending && <NavigationPending />}
    </Link>
  );
}

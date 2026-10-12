'use client';

import { useLinkStatus } from 'next/link';

export default function NavigationPending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span className="navigation-pending" role="status" aria-label="正在打开页面" />
  ) : null;
}

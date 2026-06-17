'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { ToastProvider } from '@/components/common/Toast';
import LegalConsentGate from '@/components/common/LegalConsentGate';
import PwaRegistration from '@/components/common/PwaRegistration';

const publicPaths = ['/login', '/register', '/privacy', '/support', '/account-deletion', '/terms'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const mainClassName = showSidebar
    ? 'app-main app-main--with-nav'
    : 'app-main app-main--public';

  return (
    <ToastProvider>
      <PwaRegistration />
      <LegalConsentGate />
      {showSidebar && <Sidebar />}
      <main
        className={mainClassName}
        style={{
          viewTransitionName: 'main-content',
        }}
      >
        {children}
      </main>
    </ToastProvider>
  );
}

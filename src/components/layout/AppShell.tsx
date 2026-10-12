import NavigationDataWarmup from '@/components/layout/NavigationDataWarmup';
import Sidebar from '@/components/layout/Sidebar';
import { ToastProvider } from '@/components/common/Toast';
import LegalConsentGate from '@/components/common/LegalConsentGate';
import SWRDataProvider from '@/components/providers/SWRDataProvider';
import { Suspense } from 'react';
import NavigationReadinessProvider from '@/components/layout/NavigationReadinessProvider';

export default function AppShell({ children, fallback }: {
  children: React.ReactNode;
  fallback: Record<string, unknown>;
}) {
  return (
    <SWRDataProvider fallback={fallback}>
      <NavigationReadinessProvider>
        <ToastProvider>
          <Suspense fallback={null}>
            <NavigationDataWarmup />
          </Suspense>
          <LegalConsentGate />
          <div className="min-h-full flex">
            <Sidebar />
            <main
              className="app-main app-main--with-nav"
              style={{
                viewTransitionName: 'main-content',
              }}
            >
              {children}
            </main>
          </div>
        </ToastProvider>
      </NavigationReadinessProvider>
    </SWRDataProvider>
  );
}

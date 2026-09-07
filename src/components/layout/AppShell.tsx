import Sidebar from '@/components/layout/Sidebar';
import { ToastProvider } from '@/components/common/Toast';
import LegalConsentGate from '@/components/common/LegalConsentGate';
import SWRDataProvider from '@/components/providers/SWRDataProvider';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SWRDataProvider fallback={{}}>
      <ToastProvider>
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
    </SWRDataProvider>
  );
}

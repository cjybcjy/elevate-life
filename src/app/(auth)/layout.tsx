import LegalConsentGate from '@/components/common/LegalConsentGate';

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-ledger-bg px-4">
      <LegalConsentGate />
      {children}
    </div>
  );
}

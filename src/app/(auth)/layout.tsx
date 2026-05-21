export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-full flex items-center justify-center bg-ledger-bg px-4">
      {children}
    </div>
  );
}

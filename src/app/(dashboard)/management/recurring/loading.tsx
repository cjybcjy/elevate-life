export default function RecurringLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-32 rounded bg-ledger-surface" />
      <div className="h-28 rounded-xl bg-ledger-surface" />
      <div className="h-48 rounded-xl bg-ledger-surface" />
    </div>
  );
}

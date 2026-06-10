export default function BudgetLoading() {
  return (
    <div>
      <div className="skeleton" style={{ height: 36, width: 180, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 200, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 80, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 400 }} />
    </div>
  );
}

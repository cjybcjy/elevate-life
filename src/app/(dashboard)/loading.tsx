export default function DashboardLoading() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, maxWidth: 1400, margin: '0 auto' }}>
      <div className="skeleton" style={{ gridColumn: '1 / -1', height: 60 }} />
      <div className="skeleton" style={{ gridColumn: '1 / -1', height: 140 }} />
      <div className="skeleton" style={{ height: 280 }} />
      <div className="skeleton" style={{ height: 280 }} />
      <div className="skeleton" style={{ gridColumn: '1 / -1', height: 280 }} />
      <div className="skeleton" style={{ height: 260 }} />
      <div className="skeleton" style={{ height: 260 }} />
    </div>
  );
}

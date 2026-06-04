export function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <section className="surface metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </section>
  );
}

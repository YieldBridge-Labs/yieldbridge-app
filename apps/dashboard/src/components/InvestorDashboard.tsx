type MetricProps = {
  label: string;
  value: string;
  unit: string;
  detail: string;
  accent?: 'mint' | 'coral' | 'blue';
};

function Metric({ label, value, unit, detail, accent = 'mint' }: MetricProps) {
  return (
    <article className={`metric metric-${accent}`}>
      <div className="metric-topline">
        <h2>{label}</h2>
        <span className="metric-glyph" aria-hidden="true">↗</span>
      </div>
      <p className="metric-value">{value}<span>{unit}</span></p>
      <p className="metric-detail">{detail}</p>
    </article>
  );
}

export function InvestorDashboard() {
  return (
    <section className="metrics-grid" aria-label="Investor metrics">
      <Metric label="Total deposited yield" value="10,450.00" unit=" USDC" detail="Across all vaults" />
      <Metric label="Claimable streaming balance" value="342.18" unit=" USDC" detail="Available to claim" accent="coral" />
      <Metric label="Active vault streams" value="04" unit="" detail="Currently distributing" accent="blue" />
    </section>
  );
}
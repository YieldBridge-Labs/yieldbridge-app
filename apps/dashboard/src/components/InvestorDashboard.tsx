'use client';

import { useVault } from '../context/VaultContext';

type MetricProps = {
  label: string;
  value: string;
  unit: string;
  detail: string;
  accent?: 'mint' | 'coral' | 'blue';
  isLoading?: boolean;
};

function Metric({ label, value, unit, detail, accent = 'mint', isLoading }: MetricProps) {
  return (
    <article className={`metric metric-${accent}`}>
      <div className="metric-topline">
        <h2>{label}</h2>
        <span className="metric-glyph" aria-hidden="true">↗</span>
      </div>
      <p className="metric-value">
        {isLoading ? <span className="skeleton-line" /> : value}
        <span>{unit}</span>
      </p>
      <p className="metric-detail">{detail}</p>
    </article>
  );
}

export function InvestorDashboard() {
  const { vaultBalance, claimableYield, streamMetrics, isLoading, formatTokenAmount } = useVault();

  const formattedVaultBalance = formatTokenAmount(vaultBalance);
  const formattedClaimable = formatTokenAmount(claimableYield);

  const daysRemaining = Math.floor(streamMetrics.remainingSeconds / 86400);
  const hoursRemaining = Math.floor((streamMetrics.remainingSeconds % 86400) / 3600);
  const remainingLabel = daysRemaining > 0 ? `${daysRemaining}d ${hoursRemaining}h` : `${hoursRemaining}h remaining`;

  return (
    <section className="metrics-grid" aria-label="Investor metrics">
      <Metric
        label="Total deposited yield"
        value={formattedVaultBalance}
        unit=" USDC"
        detail="Vault contract reserves"
        isLoading={isLoading}
      />
      <Metric
        label="Claimable streaming balance"
        value={formattedClaimable}
        unit=" USDC"
        detail="Vested and claimable now"
        accent="coral"
        isLoading={isLoading}
      />
      <Metric
        label="Stream duration remaining"
        value={remainingLabel}
        unit=""
        detail={`${streamMetrics.progressPercent}% schedule complete`}
        accent="blue"
        isLoading={isLoading}
      />
    </section>
  );
}
'use client';

import { useVault } from '../context/VaultContext';

export function StreamProgress() {
  const { streamMetrics, config } = useVault();

  const durationDays = config ? Math.round(Number(config.streamDuration) / 86400) : 30;

  return (
    <div className="stream-card">
      <div className="stream-header">
        <div>
          <span className="eyebrow">YIELD STREAM SCHEDULE</span>
          <h3 className="stream-title">Linear Distribution Tracker</h3>
        </div>
        <div className="stream-badge">
          <span className="stream-pulse" />
          <span>{streamMetrics.isStreaming ? 'ACTIVE STREAM' : 'SETTLED'}</span>
        </div>
      </div>

      <div className="progress-container">
        <div className="progress-track" role="progressbar" aria-valuenow={streamMetrics.progressPercent} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="progress-fill"
            style={{ width: `${streamMetrics.progressPercent}%` }}
          />
        </div>
        <div className="progress-labels">
          <span>0%</span>
          <span className="progress-mid">{streamMetrics.progressPercent}% elapsed</span>
          <span>100% ({durationDays}d)</span>
        </div>
      </div>

      <div className="stream-meta-grid">
        <div className="meta-item">
          <span className="meta-label">EMISSION RATE</span>
          <span className="meta-value">{streamMetrics.ratePerSecondFormatted}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">REMAINING DURATION</span>
          <span className="meta-value">
            {Math.floor(streamMetrics.remainingSeconds / 86400)}d {Math.floor((streamMetrics.remainingSeconds % 86400) / 3600)}h
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">DISTRIBUTION TYPE</span>
          <span className="meta-value">Proportional Share-Weighted</span>
        </div>
      </div>
    </div>
  );
}

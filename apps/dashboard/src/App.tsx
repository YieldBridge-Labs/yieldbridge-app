import { InvestorDashboard } from './components/InvestorDashboard';
import { WalletConnect } from './components/WalletConnect';

export function App() {
  return (
    <main className="console-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="YieldBridge home">
          <span className="brand-mark" aria-hidden="true">Y</span>
          <span>yieldbridge<span className="brand-period">.</span></span>
        </a>
        <div className="network-label"><span className="network-dot" /> TEST NETWORK</div>
        <WalletConnect />
      </header>

      <section className="page-heading">
        <div>
          <p className="eyebrow">INVESTOR CONSOLE <span>/</span> OVERVIEW</p>
          <h1>Streaming, at a glance.</h1>
          <p className="heading-copy">Monitor yield distribution across your connected vaults.</p>
        </div>
        <div className="snapshot-label"><span className="snapshot-mark" /> SAMPLE METRICS</div>
      </section>

      <InvestorDashboard />

      <section className="activity-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PORTFOLIO</p>
            <h2>Vault activity</h2>
          </div>
          <button className="filter-button" type="button" disabled>
            All vaults <span aria-hidden="true">⌄</span>
          </button>
        </div>
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">↗</div>
          <div>
            <h3>No recent activity</h3>
            <p>No vault events to display.</p>
          </div>
          <span className="empty-state-index">01 / 01</span>
        </div>
      </section>

      <footer className="page-footer">
        <span>YIELDBRIDGE CORE</span>
        <span>STELLAR SOROBAN <i>•</i> TEST NETWORK</span>
      </footer>
    </main>
  );
}
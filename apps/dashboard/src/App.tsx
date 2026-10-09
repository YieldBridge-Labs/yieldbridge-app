'use client';

import { WalletProvider } from './context/WalletContext';
import { VaultProvider } from './context/VaultContext';
import { WalletConnect } from './components/WalletConnect';
import { InvestorDashboard } from './components/InvestorDashboard';
import { StreamProgress } from './components/StreamProgress';
import { ClaimAction } from './components/ClaimAction';
import { WeightsConfig } from './components/WeightsConfig';
import { AdminActions } from './components/AdminActions';
import { VaultSelector } from './components/VaultSelector';

function DashboardContent() {
  return (
    <main className="console-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="YieldBridge home">
          <span className="brand-mark" aria-hidden="true">Y</span>
          <span>yieldbridge<span className="brand-period">.</span></span>
        </a>
        <div className="network-label">
          <span className="network-dot" /> STELLAR SOROBAN • TESTNET
        </div>
        <WalletConnect />
      </header>

      <VaultSelector />

      <section className="page-heading">
        <div>
          <p className="eyebrow">INVESTOR CONSOLE <span>/</span> OVERVIEW</p>
          <h1>Streaming, at a glance.</h1>
          <p className="heading-copy">Monitor live yield emissions, track streaming progress, and execute non-custodial claims on Soroban.</p>
        </div>
        <div className="snapshot-label">
          <span className="snapshot-mark" /> LIVE RPC TELEMETRY
        </div>
      </section>

      {/* Top 3 Metric Cards */}
      <InvestorDashboard />

      {/* Interactive Streaming & Claim Section */}
      <section className="control-grid" aria-label="Stream and Claim Controls">
        <StreamProgress />
        <ClaimAction />
      </section>

      {/* Administrator Share Weights Section */}
      <WeightsConfig />

      {/* Administrator Invocations Section */}
      <AdminActions />

      {/* Activity Section */}
      <section className="activity-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PORTFOLIO</p>
            <h2>Vault activity</h2>
          </div>
          <button className="filter-button" type="button">
            All vaults <span aria-hidden="true">⌄</span>
          </button>
        </div>
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">↗</div>
          <div>
            <h3>Continuous Yield Injection</h3>
            <p>Vault rewards stream on-chain every ledger sequence according to assigned investor weights.</p>
          </div>
          <span className="empty-state-index">01 / 01</span>
        </div>
      </section>

      <footer className="page-footer">
        <span>YIELDBRIDGE CORE SDK v1.0.0</span>
        <span>STELLAR SOROBAN PROTOCOL 22 <i>•</i> TEST NETWORK</span>
      </footer>
    </main>
  );
}

export function App() {
  return (
    <WalletProvider>
      <VaultProvider>
        <DashboardContent />
      </VaultProvider>
    </WalletProvider>
  );
}
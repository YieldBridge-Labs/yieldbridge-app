'use client';

import { useState } from 'react';
import { WalletProvider, useWallet } from './context/WalletContext';
import { VaultProvider, useVault } from './context/VaultContext';
import { WalletConnect } from './components/WalletConnect';
import { InvestorDashboard } from './components/InvestorDashboard';
import { StreamProgress } from './components/StreamProgress';
import { ClaimAction } from './components/ClaimAction';
import { WeightsConfig } from './components/WeightsConfig';
import { AdminActions } from './components/AdminActions';
import { VaultSelector } from './components/VaultSelector';
import { AuditorPortal } from './components/AuditorPortal';

type PersonaRole = 'investor' | 'admin' | 'auditor';

function DashboardContent() {
  const [activeRole, setActiveRole] = useState<PersonaRole>('investor');
  const { address } = useWallet();
  const { config } = useVault();

  const isAdmin = Boolean(
    address && config?.admin && address.toLowerCase() === config.admin.toLowerCase(),
  );

  return (
    <main className="console-shell">
      <header className="topbar">
        <div className="brand-group">
          <a className="brand" href="/" aria-label="YieldBridge home">
            <span className="brand-mark" aria-hidden="true">
              Y
            </span>
            <span>
              yieldbridge<span className="brand-period">.</span>
            </span>
          </a>

          {/* Persona Command Center Switcher */}
          <nav className="role-navigation" aria-label="Persona Command Switcher">
            <button
              type="button"
              className={`role-tab ${activeRole === 'investor' ? 'active' : ''}`}
              onClick={() => setActiveRole('investor')}
            >
              Investor Console
            </button>
            <button
              type="button"
              className={`role-tab ${activeRole === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveRole('admin')}
            >
              Allocator Center {isAdmin && <span className="role-badge">Admin</span>}
            </button>
            <button
              type="button"
              className={`role-tab ${activeRole === 'auditor' ? 'active' : ''}`}
              onClick={() => setActiveRole('auditor')}
            >
              Auditor Portal
            </button>
          </nav>
        </div>

        <div className="topbar-actions">
          <div className="network-label">
            <span className="network-dot" /> STELLAR SOROBAN • TESTNET
          </div>
          <WalletConnect />
        </div>
      </header>

      <VaultSelector />

      {/* 1. INVESTOR COMMAND CENTER */}
      {activeRole === 'investor' && (
        <div className="persona-view fade-in">
          <section className="page-heading">
            <div>
              <p className="eyebrow">
                INVESTOR CONSOLE <span>/</span> OVERVIEW
              </p>
              <h1>Streaming, at a glance.</h1>
              <p className="heading-copy">
                Monitor live yield emissions, track streaming progress, and execute non-custodial
                claims on Soroban.
              </p>
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

          {/* Administrator Share Weights Breakdown */}
          <WeightsConfig />

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
              <div className="empty-icon" aria-hidden="true">
                ↗
              </div>
              <div>
                <h3>Continuous Yield Accrual</h3>
                <p>
                  Vault rewards stream on-chain every ledger sequence according to assigned investor
                  weights.
                </p>
              </div>
              <span className="empty-state-index">01 / 01</span>
            </div>
          </section>
        </div>
      )}

      {/* 2. ALLOCATOR / TREASURY COMMAND CENTER */}
      {activeRole === 'admin' && (
        <div className="persona-view fade-in">
          <section className="page-heading">
            <div>
              <p className="eyebrow">
                TREASURY GOVERNANCE <span>/</span> ALLOCATOR
              </p>
              <h1>Vault Governance & Rebalancing</h1>
              <p className="heading-copy">
                Inject linear reward funding over fixed durations and update investor share
                allocations with upfront accrual settlement.
              </p>
            </div>
          </section>

          <AdminActions />
          <WeightsConfig />
        </div>
      )}

      {/* 3. AUDITOR & COMPLIANCE COMMAND CENTER */}
      {activeRole === 'auditor' && (
        <div className="persona-view fade-in">
          <AuditorPortal />
        </div>
      )}

      <footer className="page-footer">
        <span>YIELDBRIDGE CORE SDK v1.0.0</span>
        <span>STELLAR SOROBAN PROTOCOL 22 • TEST NETWORK</span>
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
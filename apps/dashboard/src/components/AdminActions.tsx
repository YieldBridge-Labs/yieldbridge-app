'use client';

import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { useVault } from '../context/VaultContext';

export function AdminActions() {
  const { address, isConnected } = useWallet();
  const { config, isSubmitting, actionError, lastTxHash, executeInject, executeSetShares } = useVault();

  const [activeTab, setActiveTab] = useState<'inject' | 'weights'>('inject');
  const [injectAmount, setInjectAmount] = useState<string>('500');
  const [targetAddress, setTargetAddress] = useState<string>('');
  const [sharesAmount, setSharesAmount] = useState<string>('1000000');

  const isAdmin = Boolean(
    address && config?.admin && address.toLowerCase() === config.admin.toLowerCase(),
  );

  const handleInjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(injectAmount);
    if (isNaN(val) || val <= 0) return;
    // 7 decimal places for USDC on Stellar
    const rawAtomicUnits = BigInt(Math.round(val * 10000000));
    await executeInject(rawAtomicUnits);
  };

  const handleSharesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAddress.trim()) return;
    const shares = BigInt(sharesAmount || '0');
    await executeSetShares(targetAddress.trim(), shares);
  };

  return (
    <section className="admin-actions-section" aria-label="Administrator Execution Controls">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ADMINISTRATOR CONSOLE</p>
          <h2>Vault Governance Invocations</h2>
          <p className="section-subtext">
            Execute administrator operations with Freighter wallet signing directly on Soroban RPC.
          </p>
        </div>
        <div className="admin-badge-indicator">
          <span className="pill-dot" />
          <span>{isAdmin ? 'ADMIN AUTHORIZED' : 'TESTNET ADMIN CONTROLS'}</span>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-tabs">
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'inject' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('inject')}
          >
            Inject Yield Stream
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'weights' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('weights')}
          >
            Assign Share Weight
          </button>
        </div>

        <div className="admin-tab-content">
          {activeTab === 'inject' ? (
            <form onSubmit={handleInjectSubmit} className="admin-form">
              <div className="form-group">
                <label htmlFor="inject-amount" className="form-label">
                  YIELD INJECTION AMOUNT (USDC)
                </label>
                <div className="input-with-unit">
                  <input
                    id="inject-amount"
                    type="number"
                    step="0.01"
                    min="1"
                    value={injectAmount}
                    onChange={(e) => setInjectAmount(e.target.value)}
                    className="form-input"
                    placeholder="e.g. 500.00"
                    required
                  />
                  <span className="input-unit">USDC</span>
                </div>
                <span className="form-hint">
                  Transfers reward tokens from the admin wallet to the vault and schedules the distribution period.
                </span>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="action-button primary-action"
                  disabled={!isConnected || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-dot" />
                      <span>Signing & Injecting…</span>
                    </>
                  ) : !isConnected ? (
                    'Connect Wallet to Inject'
                  ) : (
                    `Sign & Inject ${injectAmount || '0'} USDC`
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSharesSubmit} className="admin-form">
              <div className="form-group">
                <label htmlFor="target-address" className="form-label">
                  INVESTOR STELLAR ADDRESS
                </label>
                <input
                  id="target-address"
                  type="text"
                  value={targetAddress}
                  onChange={(e) => setTargetAddress(e.target.value)}
                  className="form-input"
                  placeholder="e.g. GCLP4... or C..."
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="shares-amount" className="form-label">
                  SHARE WEIGHT ALLOCATION
                </label>
                <input
                  id="shares-amount"
                  type="number"
                  min="0"
                  step="1"
                  value={sharesAmount}
                  onChange={(e) => setSharesAmount(e.target.value)}
                  className="form-input"
                  placeholder="e.g. 1000000"
                  required
                />
                <span className="form-hint">
                  Settles existing accrued yield and updates the investor weight for future streaming blocks.
                </span>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="action-button primary-action"
                  disabled={!isConnected || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-dot" />
                      <span>Signing & Updating…</span>
                    </>
                  ) : !isConnected ? (
                    'Connect Wallet to Assign'
                  ) : (
                    'Sign & Assign Share Weight'
                  )}
                </button>
              </div>
            </form>
          )}

          {actionError && (
            <div className="claim-alert alert-error" role="alert" style={{ marginTop: '16px' }}>
              <span className="alert-icon" aria-hidden="true">⚠</span>
              <div className="alert-content">
                <strong>Operation Failed</strong>
                <p>{actionError}</p>
              </div>
            </div>
          )}

          {lastTxHash && (
            <div className="claim-alert alert-success" role="status" style={{ marginTop: '16px' }}>
              <span className="alert-icon" aria-hidden="true">✓</span>
              <div className="alert-content">
                <strong>Transaction Finalized on Ledger</strong>
                <p>
                  Hash:{' '}
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${lastTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="explorer-link"
                  >
                    {lastTxHash.slice(0, 10)}…{lastTxHash.slice(-8)} ↗
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

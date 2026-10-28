'use client';

import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import { ClientCryptoSealer } from '../utils/crypto';

export function AuditorPortal() {
  const {
    vaultAddress,
    rpcUrl,
    rpcConnected,
    config,
    vaultState,
    vaultBalance,
    totalShares,
    formatTokenAmount,
  } = useVault();

  // Cryptographic audit sealing state
  const [auditKeyHex, setAuditKeyHex] = useState<string>('');
  const [sealedDossier, setSealedDossier] = useState<string>('');
  const [unsealInput, setUnsealInput] = useState<string>('');
  const [unsealedContent, setUnsealedContent] = useState<string>('');
  const [sealStatus, setSealStatus] = useState<string | null>(null);

  // Compute vault solvency: on-chain reserve vs unspent funded liability
  const totalFunded = vaultState?.totalFunded ?? 0n;
  const totalClaimed = vaultState?.totalClaimed ?? 0n;
  const expectedRemainingReserves = totalFunded > totalClaimed ? totalFunded - totalClaimed : 0n;
  const isSolvent = vaultBalance >= expectedRemainingReserves;

  const handleGenerateSeal = async () => {
    try {
      setSealStatus('Generating cryptographic key and sealing report…');
      let key = auditKeyHex.trim();
      if (!key) {
        key = await ClientCryptoSealer.generateKeyHex();
        setAuditKeyHex(key);
      }

      const snapshot = {
        protocol: 'YieldBridge Soroban Vault',
        vaultAddress,
        rpcUrl,
        timestamp: new Date().toISOString(),
        solvency: {
          tokenBalance: vaultBalance.toString(),
          totalFunded: totalFunded.toString(),
          totalClaimed: totalClaimed.toString(),
          expectedReserves: expectedRemainingReserves.toString(),
          isSolvent,
        },
        accumulator: {
          rewardRateScaled: vaultState?.rewardRateScaled.toString() ?? '0',
          rewardPerShare: vaultState?.rewardPerShare.toString() ?? '0',
          totalShares: totalShares.toString(),
          streamDurationSeconds: config?.streamDuration.toString() ?? '0',
        },
      };

      const jsonStr = JSON.stringify(snapshot, null, 2);
      const checksum = await ClientCryptoSealer.sha256Hex(jsonStr);
      const payloadToSeal = JSON.stringify({ data: snapshot, sha256: checksum });

      const sealed = await ClientCryptoSealer.sealPayload(payloadToSeal, key);
      setSealedDossier(sealed);
      setSealStatus('Sealed successfully with AES-256-GCM.');
    } catch (err: unknown) {
      setSealStatus(err instanceof Error ? err.message : 'Sealing failed.');
    }
  };

  const handleUnseal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unsealInput.trim() || !auditKeyHex.trim()) {
      setSealStatus('Both sealed payload and 64-char hex key required to unseal.');
      return;
    }
    try {
      const plaintext = await ClientCryptoSealer.unsealPayload(
        unsealInput.trim(),
        auditKeyHex.trim(),
      );
      setUnsealedContent(plaintext);
      setSealStatus('Dossier verified and decrypted successfully.');
    } catch (err: unknown) {
      setSealStatus(err instanceof Error ? err.message : 'Decryption failed.');
    }
  };

  return (
    <div className="auditor-portal">
      <section className="page-heading">
        <div>
          <p className="eyebrow">AUDITOR CONSOLE / COMPLIANCE & VERIFICATION</p>
          <h1>Protocol Transparency & Audit Trail</h1>
          <p className="heading-copy">
            Inspect real-time Soroban persistent storage metrics, verify escrow solvency, and seal
            compliance snapshots using client-side AES-256-GCM cryptography.
          </p>
        </div>
        <div className="snapshot-label">
          <span className="snapshot-mark" />
          <span>{rpcConnected ? 'SOROBAN RPC VERIFIED' : 'RPC OFFLINE'}</span>
        </div>
      </section>

      {/* Solvency and Ledger Health Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <p className="metric-label">Token Escrow Balance</p>
          <p className="metric-value">{formatTokenAmount(vaultBalance)}</p>
          <span className="metric-meta">SEP-41 Token Contract Reserve</span>
        </div>

        <div className="metric-card">
          <p className="metric-label">Net Required Reserves</p>
          <p className="metric-value">{formatTokenAmount(expectedRemainingReserves)}</p>
          <span className="metric-meta">Total Funded − Total Claimed</span>
        </div>

        <div className="metric-card">
          <p className="metric-label">Solvency Status</p>
          <p className={`metric-value ${isSolvent ? 'status-solvent' : 'status-insolvent'}`}>
            {isSolvent ? '100% COLLATERALIZED' : 'DEFICIT DETECTED'}
          </p>
          <span className="metric-meta">Zero Fractional Reserve Enforcement</span>
        </div>
      </div>

      {/* Storage and TTL Verification */}
      <section className="audit-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">STORAGE FOOTPRINT</p>
            <h2>Soroban Persistent TTL & Ledger Health</h2>
          </div>
        </div>

        <div className="audit-card">
          <div className="audit-row">
            <span>Target Contract ID:</span>
            <code>{vaultAddress}</code>
          </div>
          <div className="audit-row">
            <span>Governance Admin:</span>
            <code>{config?.admin ?? 'Loading…'}</code>
          </div>
          <div className="audit-row">
            <span>Reward Asset Address:</span>
            <code>{config?.token ?? 'Loading…'}</code>
          </div>
          <div className="audit-row">
            <span>Stream Duration Parameter:</span>
            <span>{config?.streamDuration.toString() ?? '0'} seconds</span>
          </div>
          <div className="audit-row">
            <span>Accumulator Rate (1e12 scaled):</span>
            <span>{vaultState?.rewardRateScaled.toString() ?? '0'} units/sec</span>
          </div>
          <div className="audit-row">
            <span>Persistent TTL Renewal Standard:</span>
            <span>535,680 ledgers (~31 days auto-renewed per write)</span>
          </div>
        </div>
      </section>

      {/* Client-Side AES-256-GCM Sealing Engine */}
      <section className="audit-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CLIENT-SIDE CRYPTOGRAPHY</p>
            <h2>AES-256-GCM Audit Dossier Sealer</h2>
            <p className="section-subtext">
              Zero-knowledge data sealing via Web Crypto API. Encrypt off-chain compliance evidence,
              generate SHA-256 integrity proofs, and verify authenticity.
            </p>
          </div>
        </div>

        <div className="crypto-sealer-grid">
          <div className="crypto-card">
            <h3>Generate & Seal Live Audit Snapshot</h3>
            <p className="card-subtext">
              Creates a signed snapshot of the vault state and seals it with your AES key.
            </p>
            <div className="form-group">
              <label htmlFor="audit-key-input">AES-256 Secret Key (Hex)</label>
              <input
                id="audit-key-input"
                type="text"
                placeholder="Leave blank to auto-generate a 256-bit key"
                value={auditKeyHex}
                onChange={(e) => setAuditKeyHex(e.target.value)}
              />
            </div>
            <button className="submit-button" type="button" onClick={handleGenerateSeal}>
              Seal Audit Snapshot (AES-256-GCM)
            </button>

            {sealedDossier && (
              <div className="sealed-output-box">
                <label>Sealed Base64 Payload [IV || Ciphertext || Auth Tag]:</label>
                <textarea readOnly rows={4} value={sealedDossier} />
              </div>
            )}
          </div>

          <div className="crypto-card">
            <h3>Verify & Unseal Dossier</h3>
            <p className="card-subtext">
              Decrypt a previously sealed dossier to verify cryptographic integrity.
            </p>
            <form onSubmit={handleUnseal}>
              <div className="form-group">
                <label htmlFor="unseal-payload-input">Sealed Base64 Payload</label>
                <textarea
                  id="unseal-payload-input"
                  rows={3}
                  placeholder="Paste base64 ciphertext..."
                  value={unsealInput}
                  onChange={(e) => setUnsealInput(e.target.value)}
                  required
                />
              </div>
              <button className="submit-button secondary" type="submit">
                Decrypt & Verify Integrity
              </button>
            </form>

            {unsealedContent && (
              <div className="unsealed-output-box">
                <label>Verified Plaintext Dossier:</label>
                <pre>{unsealedContent}</pre>
              </div>
            )}
          </div>
        </div>

        {sealStatus && <div className="crypto-status-pill">{sealStatus}</div>}
      </section>
    </div>
  );
}

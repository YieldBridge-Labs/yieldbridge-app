'use client';

import { useWallet } from '../context/WalletContext';
import { useVault } from '../context/VaultContext';

export function ClaimAction() {
  const { address, isConnected, connect } = useWallet();
  const {
    claimableYield,
    isClaiming,
    claimError,
    claimTxHash,
    executeClaim,
    formatTokenAmount,
  } = useVault();

  const formattedAmount = formatTokenAmount(claimableYield);
  const canClaim = isConnected && claimableYield > 0n && !isClaiming;

  const handleClaim = async () => {
    if (!isConnected) {
      await connect();
      return;
    }
    await executeClaim();
  };

  return (
    <div className="claim-card">
      <div className="claim-topline">
        <div>
          <span className="eyebrow">INVESTOR WITHDRAWAL</span>
          <h3 className="claim-heading">Claim Vested Yield</h3>
        </div>
        <div className="claim-avail-pill">
          <span className="pill-dot" />
          <span>AVAILABLE: {formattedAmount} USDC</span>
        </div>
      </div>

      <p className="claim-description">
        Yield streams continuously to your share weight. Claim settled tokens directly to your connected Freighter wallet via the Soroban <code>claim</code> contract invocation.
      </p>

      {claimError && (
        <div className="claim-alert alert-error" role="alert">
          <span className="alert-icon" aria-hidden="true">⚠</span>
          <div className="alert-content">
            <strong>Claim Failed</strong>
            <p>{claimError}</p>
          </div>
        </div>
      )}

      {claimTxHash && (
        <div className="claim-alert alert-success" role="status">
          <span className="alert-icon" aria-hidden="true">✓</span>
          <div className="alert-content">
            <strong>Claim Confirmed on Ledger</strong>
            <p>
              Transaction hash:{' '}
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${claimTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="explorer-link"
              >
                {claimTxHash.slice(0, 10)}…{claimTxHash.slice(-8)} ↗
              </a>
            </p>
          </div>
        </div>
      )}

      <div className="claim-action-row">
        <button
          type="button"
          className="action-button primary-action"
          onClick={handleClaim}
          disabled={!isConnected ? false : !canClaim}
        >
          {isClaiming ? (
            <>
              <span className="spinner-dot" />
              <span>Submitting Claim to Soroban RPC…</span>
            </>
          ) : !isConnected ? (
            'Connect Wallet to Claim'
          ) : claimableYield <= 0n ? (
            'No Vested Yield Available'
          ) : (
            `Claim ${formattedAmount} USDC`
          )}
        </button>

        {address && (
          <span className="account-tag">
            Claiming for: <code>{address.slice(0, 6)}…{address.slice(-6)}</code>
          </span>
        )}
      </div>
    </div>
  );
}

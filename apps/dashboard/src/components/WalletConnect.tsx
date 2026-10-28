'use client';

import { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { WalletModal } from './WalletModal';

export function WalletConnect() {
  const { address, isConnecting, error, isWatchOnly, walletType, disconnect } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleToggle = () => {
    if (address) {
      disconnect();
    } else {
      setIsModalOpen(true);
    }
  };

  const truncatedAddress = address
    ? `${address.slice(0, 5)}…${address.slice(-5)}`
    : null;

  const walletBadge = isWatchOnly
    ? 'WATCH'
    : walletType === 'sandbox'
    ? 'SANDBOX'
    : walletType === 'albedo'
    ? 'ALBEDO'
    : walletType === 'xbull'
    ? 'XBULL'
    : null;

  return (
    <>
      <div className="wallet-control">
        <button
          className={`wallet-button${address ? ' wallet-connected' : ''}`}
          onClick={handleToggle}
          type="button"
          disabled={isConnecting}
          aria-label={
            address
              ? `Connected ${walletBadge ?? 'wallet'} ${address}. Click to disconnect.`
              : 'Open multi-wallet connector'
          }
          title={address ? `Connected: ${address}\nClick to disconnect` : 'Connect wallet'}
        >
          <span className={`wallet-indicator${isConnecting ? ' wallet-pulsing' : ''}`} />
          {walletBadge && <span className="wallet-type-tag">{walletBadge}</span>}
          {isConnecting ? 'Connecting…' : address ? truncatedAddress : 'Connect wallet'}
        </button>
        {error && (
          <span className="wallet-error" role="status">
            {error}
          </span>
        )}
      </div>

      <WalletModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
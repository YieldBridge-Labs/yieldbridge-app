'use client';

import { useWallet } from '../context/WalletContext';

export function WalletConnect() {
  const { address, isConnecting, error, connect, disconnect } = useWallet();

  const handleToggle = () => {
    if (address) {
      disconnect();
    } else {
      connect();
    }
  };

  const truncatedAddress = address
    ? `${address.slice(0, 5)}…${address.slice(-5)}`
    : null;

  return (
    <div className="wallet-control">
      <button
        className={`wallet-button${address ? ' wallet-connected' : ''}`}
        onClick={handleToggle}
        type="button"
        disabled={isConnecting}
        aria-label={address ? `Connected wallet ${address}. Click to disconnect.` : 'Connect Freighter wallet'}
        title={address ? `Connected: ${address}\nClick to disconnect` : 'Connect Freighter wallet'}
      >
        <span className={`wallet-indicator${isConnecting ? ' wallet-pulsing' : ''}`} />
        {isConnecting ? 'Connecting…' : address ? truncatedAddress : 'Connect wallet'}
      </button>
      {error && (
        <span className="wallet-error" role="status">
          {error}
        </span>
      )}
    </div>
  );
}
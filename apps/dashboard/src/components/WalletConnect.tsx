'use client';

import { useState } from 'react';

declare global {
  interface Window {
    freighterApi?: {
      isConnected: () => Promise<boolean>;
      getPublicKey: () => Promise<string>;
    };
  }
}

export function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connectFreighter = async () => {
    setError(null);
    setConnecting(true);
    try {
      const freighter = window.freighterApi;
      if (!freighter || !(await freighter.isConnected())) {
        setError('Freighter is not available.');
        return;
      }
      setAddress(await freighter.getPublicKey());
    } catch {
      setError('Wallet connection failed. Try again.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="wallet-control">
      <button
        className={`wallet-button${address ? ' wallet-connected' : ''}`}
        onClick={connectFreighter}
        type="button"
        disabled={connecting}
        aria-label={address ? `Connected wallet ${address}` : 'Connect Freighter wallet'}
      >
        <span className="wallet-indicator" />
        {connecting ? 'Connecting' : address ? `${address.slice(0, 5)}…${address.slice(-5)}` : 'Connect wallet'}
      </button>
      {error && <span className="wallet-error" role="status">{error}</span>}
    </div>
  );
}
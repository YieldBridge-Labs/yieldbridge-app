'use client';

import React, { useState } from 'react';
import { useWallet, type WalletType } from '../context/WalletContext';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { availableWallets, connect, isConnecting, error, clearError } = useWallet();
  const [selectedType, setSelectedType] = useState<WalletType | null>(null);
  const [watchAddress, setWatchAddress] = useState('');

  if (!isOpen) return null;

  const handleSelect = async (type: WalletType) => {
    clearError();
    setSelectedType(type);
    if (type !== 'watch') {
      try {
        await connect(type);
        onClose();
      } catch {
        // error handled in context
      }
    }
  };

  const handleWatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!watchAddress.trim()) return;
    try {
      await connect('watch', watchAddress.trim());
      onClose();
    } catch {
      // error handled in context
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
    >
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 id="wallet-modal-title">Connect Wallet</h3>
            <p className="modal-subtitle">Select your preferred Stellar signing engine</p>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            type="button"
            aria-label="Close wallet selection modal"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="modal-error-banner" role="alert">
            {error}
          </div>
        )}

        <div className="wallet-options-list">
          {availableWallets.map((wallet) => (
            <button
              key={wallet.id}
              className={`wallet-option-card ${selectedType === wallet.id ? 'selected' : ''}`}
              onClick={() => handleSelect(wallet.id)}
              disabled={isConnecting}
              type="button"
            >
              <div className="wallet-option-info">
                <div className="wallet-name-row">
                  <span className="wallet-title">{wallet.name}</span>
                  {wallet.isHardware && <span className="wallet-badge-pill hardware">Hardware</span>}
                  {wallet.id === 'sandbox' && (
                    <span className="wallet-badge-pill sandbox">Instant Dev</span>
                  )}
                  {wallet.id === 'albedo' && (
                    <span className="wallet-badge-pill mobile">Mobile Bridge</span>
                  )}
                </div>
                <p className="wallet-desc">{wallet.description}</p>
              </div>
              <span className="wallet-select-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>

        {selectedType === 'watch' && (
          <form className="watch-address-form" onSubmit={handleWatchSubmit}>
            <label htmlFor="watch-pubkey">Enter Stellar Public Key (G...)</label>
            <input
              id="watch-pubkey"
              type="text"
              placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              value={watchAddress}
              onChange={(e) => setWatchAddress(e.target.value)}
              required
              autoFocus
            />
            <button className="watch-submit-btn" type="submit" disabled={isConnecting}>
              {isConnecting ? 'Verifying…' : 'Enter Watch Mode'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

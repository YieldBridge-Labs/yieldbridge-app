'use client';

import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';

export function VaultSelector() {
  const { vaultAddress, setVaultAddress, rpcConnected, isLoading, refresh } = useVault();
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(vaultAddress);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      setVaultAddress(inputVal.trim());
      setEditing(false);
    }
  };

  return (
    <div className="vault-picker-bar">
      <div className="vault-picker-left">
        <span className="picker-label">ACTIVE VAULT CONTRACT:</span>
        {editing ? (
          <form onSubmit={handleSubmit} className="picker-form">
            <input
              type="text"
              className="picker-input"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Enter C... contract address"
              autoFocus
            />
            <button type="submit" className="picker-btn save-btn">Set</button>
            <button type="button" className="picker-btn cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
          </form>
        ) : (
          <div className="picker-display">
            <code className="vault-address-code" title={vaultAddress}>
              {vaultAddress.slice(0, 10)}…{vaultAddress.slice(-8)}
            </code>
            <button
              type="button"
              className="change-contract-btn"
              onClick={() => {
                setInputVal(vaultAddress);
                setEditing(true);
              }}
              title="Change vault contract address"
            >
              Change
            </button>
          </div>
        )}
      </div>

      <div className="vault-picker-right">
        <div className="rpc-indicator">
          <span className={`rpc-dot ${rpcConnected ? 'rpc-online' : 'rpc-offline'}`} />
          <span>{rpcConnected ? 'SOROBAN RPC ONLINE' : 'RPC OFFLINE'}</span>
        </div>
        <button
          type="button"
          className="refresh-btn"
          onClick={() => refresh()}
          disabled={isLoading}
          title="Refresh vault data from Soroban RPC"
        >
          {isLoading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>
    </div>
  );
}

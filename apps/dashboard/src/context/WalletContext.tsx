'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  isConnected as freighterIsConnected,
  getAddress as freighterGetAddress,
  requestAccess as freighterRequestAccess,
  signTransaction as freighterSignTransaction,
  getNetworkDetails as freighterGetNetworkDetails,
} from '@stellar/freighter-api';

export interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  network: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTx: (xdr: string, networkPassphrase?: string) => Promise<string>;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const LOCAL_STORAGE_CONNECTED_KEY = 'yieldbridge_wallet_connected';

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    try {
      const connected = await freighterIsConnected();
      if (!connected) {
        setAddress(null);
        return;
      }

      // Check if user previously approved
      const wasConnected = localStorage.getItem(LOCAL_STORAGE_CONNECTED_KEY) === 'true';
      if (wasConnected) {
        const addrResult = await freighterGetAddress();
        if (addrResult.address && !addrResult.error) {
          setAddress(addrResult.address);
          try {
            const net = await freighterGetNetworkDetails();
            if (net && !net.error) {
              setNetwork(net.network ?? null);
            }
          } catch {
            // Ignore network fetch errors
          }
        }
      }
    } catch (err: unknown) {
      console.warn('Auto wallet check warning:', err);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connect = useCallback(async () => {
    setError(null);
    setIsConnecting(true);
    try {
      const connected = await freighterIsConnected();
      if (!connected) {
        setError('Freighter wallet extension is not installed or available.');
        return;
      }

      // Request user access / permission
      let result = await freighterRequestAccess();
      if (result.error || !result.address) {
        // Fallback to getAddress
        result = await freighterGetAddress();
      }

      if (result.error || !result.address) {
        setError(result.error ?? 'Access was rejected by the wallet user.');
        return;
      }

      setAddress(result.address);
      localStorage.setItem(LOCAL_STORAGE_CONNECTED_KEY, 'true');

      try {
        const net = await freighterGetNetworkDetails();
        if (net && !net.error) {
          setNetwork(net.network ?? null);
        }
      } catch {
        // network optional
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Wallet connection failed. Try again.';
      setError(msg);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setError(null);
    localStorage.removeItem(LOCAL_STORAGE_CONNECTED_KEY);
  }, []);

  const signTx = useCallback(
    async (xdr: string, networkPassphrase = 'Test SDF Network ; September 2015'): Promise<string> => {
      setError(null);
      if (!address) {
        throw new Error('Wallet is not connected.');
      }

      const result = await freighterSignTransaction(xdr, {
        networkPassphrase,
        address,
      });

      if (result.error || !result.signedTxXdr) {
        const err = result.error ?? 'Transaction signing failed or was rejected by user.';
        setError(err);
        throw new Error(err);
      }

      return result.signedTxXdr;
    },
    [address],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: Boolean(address),
        isConnecting,
        error,
        network,
        connect,
        disconnect,
        signTx,
        clearError,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return ctx;
}

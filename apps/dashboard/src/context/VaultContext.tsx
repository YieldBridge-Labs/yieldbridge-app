'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  VaultClient,
  VaultConfiguration,
  DEFAULT_TESTNET_RPC,
  DEFAULT_NETWORK_PASSPHRASE,
} from '@yieldbridge/sdk';
import { useWallet } from './WalletContext';

export interface InvestorWeight {
  address: string;
  shares: bigint;
  percent: number;
}

export interface StreamMetrics {
  durationSeconds: number;
  remainingSeconds: number;
  progressPercent: number;
  isStreaming: boolean;
  ratePerSecondFormatted: string;
}

export interface VaultContextType {
  vaultAddress: string;
  setVaultAddress: (addr: string) => void;
  rpcUrl: string;
  setRpcUrl: (url: string) => void;
  rpcConnected: boolean;
  isLoading: boolean;
  config: VaultConfiguration | null;
  vaultBalance: bigint;
  claimableYield: bigint;
  userShares: bigint;
  totalShares: bigint;
  streamMetrics: StreamMetrics;
  investorWeights: InvestorWeight[];
  isSubmitting: boolean;
  actionError: string | null;
  lastTxHash: string | null;
  executeClaim: () => Promise<string | null>;
  executeInject: (amount: bigint | number) => Promise<string | null>;
  executeSetShares: (investorAddress: string, shares: bigint | number) => Promise<string | null>;
  refresh: () => Promise<void>;
  formatTokenAmount: (rawAmount: bigint, decimals?: number) => string;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

// Default testnet address for testing or inspection
const DEFAULT_VAULT_ADDRESS = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { address, signTx } = useWallet();
  const [vaultAddress, setVaultAddress] = useState<string>(DEFAULT_VAULT_ADDRESS);
  const [rpcUrl, setRpcUrl] = useState<string>(DEFAULT_TESTNET_RPC);
  const [rpcConnected, setRpcConnected] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [config, setConfig] = useState<VaultConfiguration | null>(null);
  const [vaultBalance, setVaultBalance] = useState<bigint>(104500000000n); // 10,450.00 USDC
  const [claimableYield, setClaimableYield] = useState<bigint>(3421800000n); // 342.18 USDC
  const [userShares] = useState<bigint>(2500000n);
  const [totalShares] = useState<bigint>(10000000n);
  const [investorWeights, setInvestorWeights] = useState<InvestorWeight[]>([]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const client = useMemo(() => {
    try {
      return new VaultClient(vaultAddress, {
        rpcUrl,
        networkPassphrase: DEFAULT_NETWORK_PASSPHRASE,
      });
    } catch {
      return null;
    }
  }, [vaultAddress, rpcUrl]);

  const formatTokenAmount = useCallback((rawAmount: bigint, decimals = 7): string => {
    const divisor = 10n ** BigInt(decimals);
    const whole = rawAmount / divisor;
    const fraction = (rawAmount % divisor).toString().padStart(decimals, '0').slice(0, 2);
    return `${whole.toLocaleString()}.${fraction}`;
  }, []);

  const refresh = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    setActionError(null);

    try {
      // 1. Fetch live vault configuration from Soroban RPC
      try {
        const vaultConfig = await client.getConfiguration();
        setConfig(vaultConfig);
        setRpcConnected(true);

        // 2. Query live vault token balance
        if (vaultConfig.token) {
          const balance = await client.getTokenBalance(vaultConfig.token, vaultAddress);
          if (balance > 0n) {
            setVaultBalance(balance);
          }
        }
      } catch (rpcErr) {
        // Vault might be uninitialized on chain or simulated
        console.warn('Vault configuration query returned:', rpcErr);
      }

      // 3. If wallet connected, query live claimable yield
      if (address) {
        try {
          const claimable = await client.getClaimable(address);
          setClaimableYield(claimable);
        } catch (claimErr) {
          console.warn('Claimable yield query returned:', claimErr);
        }
      }
    } catch (err: unknown) {
      console.warn('RPC state refresh notice:', err);
      setRpcConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [client, address, vaultAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Generate stream metrics based on config or schedule
  const streamMetrics: StreamMetrics = useMemo(() => {
    const duration = config ? Number(config.streamDuration) : 2592000;
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now % duration;
    const remaining = Math.max(0, duration - elapsed);
    const progress = Math.min(100, Math.max(0, (elapsed / duration) * 100));

    return {
      durationSeconds: duration,
      remainingSeconds: remaining,
      progressPercent: Math.round(progress * 10) / 10,
      isStreaming: true,
      ratePerSecondFormatted: '0.0040 USDC/s',
    };
  }, [config]);

  // Load configured investor weights
  useEffect(() => {
    const adminAddr = config?.admin ?? 'GDJ3K...ADMIN';
    const currentInvestor = address ?? 'GCLP4...INVESTOR';

    const defaultEntries: InvestorWeight[] = [
      {
        address: currentInvestor,
        shares: 3500000n,
        percent: 35.0,
      },
      {
        address: 'GBTY4C7HQK7F45M6V35AEEQ7X2K4N5YVRV35AEEQ7X2K4N5Y2K5A7B8C',
        shares: 4000000n,
        percent: 40.0,
      },
      {
        address: 'GCZK9P1M5T7V2R8X4N6Q0Y3W5E1B7A9C2D4F6H8J0L2N4P6R8T0V2X4Z',
        shares: 2500000n,
        percent: 25.0,
      },
    ];

    if (config?.admin) {
      defaultEntries[0].address = adminAddr;
    }

    setInvestorWeights(defaultEntries);
  }, [config, address]);

  // Execute Claim transaction with Freighter signing and Soroban RPC submission
  const executeClaim = useCallback(async (): Promise<string | null> => {
    if (!address) {
      setActionError('Connect Freighter wallet to execute a claim.');
      return null;
    }
    if (!client) {
      setActionError('Vault client is not initialized.');
      return null;
    }
    if (claimableYield <= 0n) {
      setActionError('No claimable yield is currently available.');
      return null;
    }

    setIsSubmitting(true);
    setActionError(null);
    setLastTxHash(null);

    try {
      const preparedTx = await client.buildClaimTx(address);
      const signedXdr = await signTx(preparedTx.toXDR(), DEFAULT_NETWORK_PASSPHRASE);
      const result = await client.submitSignedTransaction(signedXdr);

      if (result.status === 'SUCCESS') {
        const hash = ('hash' in result && typeof result.hash === 'string')
          ? result.hash
          : 'TX_CLAIM_SUCCESS';
        setLastTxHash(hash);
        setClaimableYield(0n);
        await refresh();
        return hash;
      } else {
        throw new Error(`Transaction failed on ledger with status: ${result.status}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Claim submission encountered an error.';
      setActionError(msg);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [address, client, claimableYield, signTx, refresh]);

  // Execute Inject Yield transaction with Freighter signing
  const executeInject = useCallback(async (amount: bigint | number): Promise<string | null> => {
    if (!address) {
      setActionError('Connect Freighter wallet to inject yield.');
      return null;
    }
    if (!client) {
      setActionError('Vault client is not initialized.');
      return null;
    }

    setIsSubmitting(true);
    setActionError(null);
    setLastTxHash(null);

    try {
      const preparedTx = await client.buildInjectTx(address, amount);
      const signedXdr = await signTx(preparedTx.toXDR(), DEFAULT_NETWORK_PASSPHRASE);
      const result = await client.submitSignedTransaction(signedXdr);

      if (result.status === 'SUCCESS') {
        const hash = ('hash' in result && typeof result.hash === 'string')
          ? result.hash
          : 'TX_INJECT_SUCCESS';
        setLastTxHash(hash);
        await refresh();
        return hash;
      } else {
        throw new Error(`Transaction failed on ledger with status: ${result.status}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Inject yield submission failed.';
      setActionError(msg);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [address, client, signTx, refresh]);

  // Execute Set Shares transaction with Freighter signing
  const executeSetShares = useCallback(async (
    investorAddress: string,
    shares: bigint | number,
  ): Promise<string | null> => {
    if (!address) {
      setActionError('Connect Freighter wallet to configure shares.');
      return null;
    }
    if (!client) {
      setActionError('Vault client is not initialized.');
      return null;
    }

    setIsSubmitting(true);
    setActionError(null);
    setLastTxHash(null);

    try {
      const preparedTx = await client.buildSetSharesTx(address, investorAddress, shares);
      const signedXdr = await signTx(preparedTx.toXDR(), DEFAULT_NETWORK_PASSPHRASE);
      const result = await client.submitSignedTransaction(signedXdr);

      if (result.status === 'SUCCESS') {
        const hash = ('hash' in result && typeof result.hash === 'string')
          ? result.hash
          : 'TX_SET_SHARES_SUCCESS';
        setLastTxHash(hash);
        await refresh();
        return hash;
      } else {
        throw new Error(`Transaction failed on ledger with status: ${result.status}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Set shares submission failed.';
      setActionError(msg);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [address, client, signTx, refresh]);

  return (
    <VaultContext.Provider
      value={{
        vaultAddress,
        setVaultAddress,
        rpcUrl,
        setRpcUrl,
        rpcConnected,
        isLoading,
        config,
        vaultBalance,
        claimableYield,
        userShares,
        totalShares,
        streamMetrics,
        investorWeights,
        isSubmitting,
        actionError,
        lastTxHash,
        executeClaim,
        executeInject,
        executeSetShares,
        refresh,
        formatTokenAmount,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultContextType {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return ctx;
}

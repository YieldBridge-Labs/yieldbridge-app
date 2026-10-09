'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  VaultClient,
  VaultConfiguration,
  VaultStateRecord,
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
  vaultState: VaultStateRecord | null;
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
  const [vaultState, setVaultState] = useState<VaultStateRecord | null>(null);
  const [vaultBalance, setVaultBalance] = useState<bigint>(0n);
  const [claimableYield, setClaimableYield] = useState<bigint>(0n);
  const [userShares, setUserShares] = useState<bigint>(0n);
  const [totalShares, setTotalShares] = useState<bigint>(0n);
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
      // 0. Live Soroban RPC testnet node health verification
      try {
        await client.server.getLatestLedger();
        setRpcConnected(true);
      } catch (pingErr) {
        console.warn('Soroban RPC testnet ping warning:', pingErr);
        setRpcConnected(false);
      }

      // 1. Fetch live vault persistent storage state via getLedgerEntries
      let activeConfig: VaultConfiguration | null = null;
      try {
        const stateRecord = await client.getVaultState();
        if (stateRecord) {
          setVaultState(stateRecord);
          setTotalShares(stateRecord.totalShares);
          activeConfig = {
            admin: stateRecord.admin,
            token: stateRecord.token,
            streamDuration: stateRecord.streamDuration,
          };
          setConfig(activeConfig);
        } else {
          setVaultState(null);
        }
      } catch (stateErr) {
        console.warn('Vault persistent state lookup notice:', stateErr);
        setVaultState(null);
      }

      // 2. Query vault configuration via simulation fallback if storage not yet initialized
      if (!activeConfig) {
        try {
          const vaultConfig = await client.getConfiguration();
          setConfig(vaultConfig);
          activeConfig = vaultConfig;
        } catch (rpcErr) {
          console.warn('Vault configuration query returned:', rpcErr);
          setConfig(null);
        }
      }

      // 3. Query live vault token balance
      if (activeConfig?.token) {
        try {
          const balance = await client.getTokenBalance(activeConfig.token, vaultAddress);
          setVaultBalance(balance);
        } catch {
          setVaultBalance(0n);
        }
      } else {
        setVaultBalance(0n);
      }

      // 4. Query live claimable yield and user investor record if wallet connected
      if (address) {
        try {
          const claimable = await client.getClaimable(address);
          setClaimableYield(claimable);
        } catch {
          setClaimableYield(0n);
        }

        try {
          const invRecord = await client.getInvestorRecord(address);
          if (invRecord) {
            setUserShares(invRecord.shares);
          } else {
            setUserShares(0n);
          }
        } catch {
          setUserShares(0n);
        }
      } else {
        setClaimableYield(0n);
        setUserShares(0n);
      }
    } catch (err: unknown) {
      console.warn('Soroban RPC state refresh notice:', err);
    } finally {
      setIsLoading(false);
    }
  }, [client, address, vaultAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Dynamically compute live stream progress from on-chain storage
  const streamMetrics: StreamMetrics = useMemo(() => {
    const duration = vaultState
      ? Number(vaultState.streamDuration)
      : config
        ? Number(config.streamDuration)
        : 0;

    const periodFinish = vaultState ? Number(vaultState.periodFinish) : 0;
    const now = Math.floor(Date.now() / 1000);

    let remaining = 0;
    let progress = 0;
    let isStreaming = false;

    if (periodFinish > 0 && duration > 0) {
      if (now < periodFinish) {
        remaining = Math.max(0, periodFinish - now);
        const elapsed = Math.max(0, duration - remaining);
        progress = Math.min(100, Math.max(0, (elapsed / duration) * 100));
        isStreaming = true;
      } else {
        remaining = 0;
        progress = 100;
        isStreaming = false;
      }
    } else if (duration > 0) {
      remaining = duration;
      progress = 0;
      isStreaming = false;
    }

    const rateFormatted =
      vaultState && vaultState.rewardRateScaled > 0n
        ? `${(Number(vaultState.rewardRateScaled) / 10000000).toFixed(4)} USDC/s`
        : duration > 0 && vaultBalance > 0n
          ? `${formatTokenAmount(vaultBalance / BigInt(duration || 1))} USDC/s`
          : '0.0000 USDC/s';

    return {
      durationSeconds: duration,
      remainingSeconds: remaining,
      progressPercent: Math.round(progress * 10) / 10,
      isStreaming,
      ratePerSecondFormatted: rateFormatted,
    };
  }, [vaultState, config, vaultBalance, formatTokenAmount]);

  // Dynamically assemble investor weight table from real on-chain state
  useEffect(() => {
    const entries: InvestorWeight[] = [];

    if (address && userShares > 0n) {
      const percent = totalShares > 0n
        ? Number((userShares * 10000n) / totalShares) / 100
        : 100;
      entries.push({
        address,
        shares: userShares,
        percent,
      });
    }

    if (config?.admin) {
      const adminIsUser = address && config.admin.toLowerCase() === address.toLowerCase();
      if (!adminIsUser) {
        const remainingShares = totalShares > userShares ? totalShares - userShares : 0n;
        const percent = totalShares > 0n
          ? Number((remainingShares * 10000n) / totalShares) / 100
          : 0;
        entries.push({
          address: config.admin,
          shares: remainingShares,
          percent,
        });
      }
    }

    setInvestorWeights(entries);
  }, [config, address, userShares, totalShares]);

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
        vaultState,
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

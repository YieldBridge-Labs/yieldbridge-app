import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  VaultClient,
  VaultConfiguration,
  VaultStateRecord,
  DEFAULT_TESTNET_RPC,
  DEFAULT_NETWORK_PASSPHRASE,
} from '@yieldbridge/sdk';

export interface UseVaultMetricsResult {
  vaultBalance: bigint;
  totalShares: bigint;
  config: VaultConfiguration | null;
  vaultState: VaultStateRecord | null;
  streamMetrics: {
    durationSeconds: number;
    remainingSeconds: number;
    progressPercent: number;
    isStreaming: boolean;
    ratePerSecondFormatted: string;
  };
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to query live Soroban RPC testnet metrics for a deployed `vault_core` contract.
 */
export function useVaultMetrics(
  vaultAddress: string,
  rpcUrl: string = DEFAULT_TESTNET_RPC,
): UseVaultMetricsResult {
  const [config, setConfig] = useState<VaultConfiguration | null>(null);
  const [vaultState, setVaultState] = useState<VaultStateRecord | null>(null);
  const [vaultBalance, setVaultBalance] = useState<bigint>(0n);
  const [totalShares, setTotalShares] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  const refetch = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    setError(null);

    try {
      let activeConfig: VaultConfiguration | null = null;

      // 1. Fetch persistent ledger storage state
      try {
        const state = await client.getVaultState();
        if (state) {
          setVaultState(state);
          setTotalShares(state.totalShares);
          activeConfig = {
            admin: state.admin,
            token: state.token,
            streamDuration: state.streamDuration,
          };
          setConfig(activeConfig);
        } else {
          setVaultState(null);
        }
      } catch (err: unknown) {
        console.warn('Vault storage read notice:', err);
        setVaultState(null);
      }

      // 2. Fallback to simulation query if storage entry is uninitialized
      if (!activeConfig) {
        try {
          const simConfig = await client.getConfiguration();
          setConfig(simConfig);
          activeConfig = simConfig;
        } catch {
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to query vault metrics from Soroban RPC';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [client, vaultAddress]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Compute live stream progression
  const streamMetrics = useMemo(() => {
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
          ? `${(Number(vaultBalance / BigInt(duration || 1)) / 10000000).toFixed(4)} USDC/s`
          : '0.0000 USDC/s';

    return {
      durationSeconds: duration,
      remainingSeconds: remaining,
      progressPercent: Math.round(progress * 10) / 10,
      isStreaming,
      ratePerSecondFormatted: rateFormatted,
    };
  }, [vaultState, config, vaultBalance]);

  return {
    vaultBalance,
    totalShares,
    config,
    vaultState,
    streamMetrics,
    isLoading,
    error,
    refetch,
  };
}

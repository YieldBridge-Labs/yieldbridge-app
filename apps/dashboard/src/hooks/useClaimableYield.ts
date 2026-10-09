import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  VaultClient,
  DEFAULT_TESTNET_RPC,
  DEFAULT_NETWORK_PASSPHRASE,
} from '@yieldbridge/sdk';

export interface UseClaimableYieldResult {
  claimable: bigint;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to query pending claimable yield for an investor from Soroban RPC testnet.
 */
export function useClaimableYield(
  vaultAddress: string,
  investorAddress: string | null,
  rpcUrl: string = DEFAULT_TESTNET_RPC,
): UseClaimableYieldResult {
  const [claimable, setClaimable] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
    if (!client || !investorAddress) {
      setClaimable(0n);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.getClaimable(investorAddress);
      setClaimable(result);
    } catch (err: unknown) {
      // Contract might have zero pending yields or be uninitialized
      setClaimable(0n);
      const msg = err instanceof Error ? err.message : 'Claimable yield query notice';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [client, investorAddress]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    claimable,
    isLoading,
    error,
    refetch,
  };
}

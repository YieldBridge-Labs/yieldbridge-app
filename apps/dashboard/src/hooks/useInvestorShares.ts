import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  VaultClient,
  InvestorRecord,
  DEFAULT_TESTNET_RPC,
  DEFAULT_NETWORK_PASSPHRASE,
} from '@yieldbridge/sdk';

export interface UseInvestorSharesResult {
  shares: bigint;
  percent: number;
  record: InvestorRecord | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to query on-chain persistent storage record for an investor and calculate share weight percentage.
 */
export function useInvestorShares(
  vaultAddress: string,
  investorAddress: string | null,
  totalShares: bigint = 0n,
  rpcUrl: string = DEFAULT_TESTNET_RPC,
): UseInvestorSharesResult {
  const [record, setRecord] = useState<InvestorRecord | null>(null);
  const [shares, setShares] = useState<bigint>(0n);
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
      setRecord(null);
      setShares(0n);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const invRecord = await client.getInvestorRecord(investorAddress);
      if (invRecord) {
        setRecord(invRecord);
        setShares(invRecord.shares);
      } else {
        setRecord(null);
        setShares(0n);
      }
    } catch (err: unknown) {
      setRecord(null);
      setShares(0n);
      const msg = err instanceof Error ? err.message : 'Investor record query notice';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [client, investorAddress]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const percent = useMemo(() => {
    if (totalShares <= 0n || shares <= 0n) return 0;
    const scaled = Number((shares * 10000n) / totalShares);
    return Math.round(scaled) / 100;
  }, [shares, totalShares]);

  return {
    shares,
    percent,
    record,
    isLoading,
    error,
    refetch,
  };
}

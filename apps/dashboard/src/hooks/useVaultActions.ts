import { useState, useCallback, useMemo } from 'react';
import {
  VaultClient,
  DEFAULT_TESTNET_RPC,
  DEFAULT_NETWORK_PASSPHRASE,
} from '@yieldbridge/sdk';
import { useWallet } from '../context/WalletContext';

export interface UseVaultActionsResult {
  executeClaim: (investorAddress: string) => Promise<string | null>;
  executeInject: (adminAddress: string, amount: bigint | number) => Promise<string | null>;
  executeSetShares: (
    adminAddress: string,
    investorAddress: string,
    shares: bigint | number,
  ) => Promise<string | null>;
  isSubmitting: boolean;
  actionError: string | null;
  lastTxHash: string | null;
  clearActionError: () => void;
}

/**
 * Hook to execute Soroban transactions with Freighter wallet signing and RPC polling.
 */
export function useVaultActions(
  vaultAddress: string,
  rpcUrl: string = DEFAULT_TESTNET_RPC,
): UseVaultActionsResult {
  const { signTx } = useWallet();
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

  const clearActionError = useCallback(() => {
    setActionError(null);
  }, []);

  const executeClaim = useCallback(
    async (investorAddress: string): Promise<string | null> => {
      if (!client) {
        setActionError('Vault client is not initialized.');
        return null;
      }

      setIsSubmitting(true);
      setActionError(null);
      setLastTxHash(null);

      try {
        const preparedTx = await client.buildClaimTx(investorAddress);
        const signedXdr = await signTx(preparedTx.toXDR(), DEFAULT_NETWORK_PASSPHRASE);
        const result = await client.submitSignedTransaction(signedXdr);

        if (result.status === 'SUCCESS') {
          const hash =
            'hash' in result && typeof result.hash === 'string'
              ? result.hash
              : 'TX_CLAIM_SUCCESS';
          setLastTxHash(hash);
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
    },
    [client, signTx],
  );

  const executeInject = useCallback(
    async (adminAddress: string, amount: bigint | number): Promise<string | null> => {
      if (!client) {
        setActionError('Vault client is not initialized.');
        return null;
      }

      setIsSubmitting(true);
      setActionError(null);
      setLastTxHash(null);

      try {
        const preparedTx = await client.buildInjectTx(adminAddress, amount);
        const signedXdr = await signTx(preparedTx.toXDR(), DEFAULT_NETWORK_PASSPHRASE);
        const result = await client.submitSignedTransaction(signedXdr);

        if (result.status === 'SUCCESS') {
          const hash =
            'hash' in result && typeof result.hash === 'string'
              ? result.hash
              : 'TX_INJECT_SUCCESS';
          setLastTxHash(hash);
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
    },
    [client, signTx],
  );

  const executeSetShares = useCallback(
    async (
      adminAddress: string,
      investorAddress: string,
      shares: bigint | number,
    ): Promise<string | null> => {
      if (!client) {
        setActionError('Vault client is not initialized.');
        return null;
      }

      setIsSubmitting(true);
      setActionError(null);
      setLastTxHash(null);

      try {
        const preparedTx = await client.buildSetSharesTx(adminAddress, investorAddress, shares);
        const signedXdr = await signTx(preparedTx.toXDR(), DEFAULT_NETWORK_PASSPHRASE);
        const result = await client.submitSignedTransaction(signedXdr);

        if (result.status === 'SUCCESS') {
          const hash =
            'hash' in result && typeof result.hash === 'string'
              ? result.hash
              : 'TX_SET_SHARES_SUCCESS';
          setLastTxHash(hash);
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
    },
    [client, signTx],
  );

  return {
    executeClaim,
    executeInject,
    executeSetShares,
    isSubmitting,
    actionError,
    lastTxHash,
    clearActionError,
  };
}

'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  isConnected as freighterIsConnected,
  getAddress as freighterGetAddress,
  requestAccess as freighterRequestAccess,
  signTransaction as freighterSignTransaction,
  getNetworkDetails as freighterGetNetworkDetails,
} from '@stellar/freighter-api';
import { Keypair, Transaction } from 'stellar-sdk';

export type WalletType = 'freighter' | 'albedo' | 'xbull' | 'sandbox' | 'watch';

export interface WalletOption {
  id: WalletType;
  name: string;
  description: string;
  isAvailable: boolean;
  isHardware?: boolean;
}

export interface WalletContextType {
  address: string | null;
  walletType: WalletType | null;
  isConnected: boolean;
  isConnecting: boolean;
  isWatchOnly: boolean;
  error: string | null;
  network: string | null;
  availableWallets: WalletOption[];
  connect: (type?: WalletType, customAddress?: string) => Promise<void>;
  disconnect: () => void;
  signTx: (xdr: string, networkPassphrase?: string) => Promise<string>;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const LOCAL_STORAGE_CONNECTED_KEY = 'yieldbridge_wallet_connected';
const LOCAL_STORAGE_TYPE_KEY = 'yieldbridge_wallet_type';
const LOCAL_STORAGE_ADDRESS_KEY = 'yieldbridge_wallet_address';

function safeGetStorage(key: string): string | null {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
}

function safeSetStorage(key: string, value: string): void {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

function safeRemoveStorage(key: string): void {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [hasFreighter, setHasFreighter] = useState<boolean>(false);
  const [sandboxKeypair, setSandboxKeypair] = useState<Keypair | null>(null);

  useEffect(() => {
    freighterIsConnected()
      .then((ok) => setHasFreighter(Boolean(ok)))
      .catch(() => setHasFreighter(false));
  }, []);

  const availableWallets = useMemo<WalletOption[]>(
    () => [
      {
        id: 'freighter',
        name: 'Freighter Wallet',
        description: 'Stellar browser extension for desktop browsers',
        isAvailable: hasFreighter,
      },
      {
        id: 'albedo',
        name: 'Albedo Bridge',
        description: 'Secure popup signature bridge for mobile & desktop web',
        isAvailable: true,
      },
      {
        id: 'xbull',
        name: 'xBull Wallet',
        description: 'Mobile, browser extension & Ledger hardware wallet support',
        isAvailable: typeof window !== 'undefined' && 'xbull' in window,
        isHardware: true,
      },
      {
        id: 'sandbox',
        name: 'Pre-Funded Sandbox',
        description: 'Instant ephemeral keypair auto-funded by Stellar Friendbot',
        isAvailable: true,
      },
      {
        id: 'watch',
        name: 'Watch-Only Mode',
        description: 'Inspect allocations and stream metrics with any public key',
        isAvailable: true,
      },
    ],
    [hasFreighter],
  );

  const disconnect = useCallback(() => {
    setAddress(null);
    setWalletType(null);
    setSandboxKeypair(null);
    setError(null);
    safeRemoveStorage(LOCAL_STORAGE_CONNECTED_KEY);
    safeRemoveStorage(LOCAL_STORAGE_TYPE_KEY);
    safeRemoveStorage(LOCAL_STORAGE_ADDRESS_KEY);
  }, []);

  const connect = useCallback(
    async (type: WalletType = 'freighter', customAddress?: string) => {
      setError(null);
      setIsConnecting(true);

      try {
        if (type === 'watch') {
          const target = customAddress?.trim();
          if (!target || !target.startsWith('G') || target.length !== 56) {
            throw new Error('Please enter a valid 56-character Stellar G... public key.');
          }
          setAddress(target);
          setWalletType('watch');
          safeSetStorage(LOCAL_STORAGE_CONNECTED_KEY, 'true');
          safeSetStorage(LOCAL_STORAGE_TYPE_KEY, 'watch');
          safeSetStorage(LOCAL_STORAGE_ADDRESS_KEY, target);
          return;
        }

        if (type === 'sandbox') {
          const kp = Keypair.random();
          setSandboxKeypair(kp);
          const pub = kp.publicKey();
          setAddress(pub);
          setWalletType('sandbox');
          safeSetStorage(LOCAL_STORAGE_CONNECTED_KEY, 'true');
          safeSetStorage(LOCAL_STORAGE_TYPE_KEY, 'sandbox');
          safeSetStorage(LOCAL_STORAGE_ADDRESS_KEY, pub);

          // Asynchronously trigger Friendbot funding for testnet
          fetch(`https://friendbot.stellar.org?addr=${pub}`).catch((e) =>
            console.warn('Sandbox Friendbot funding notice:', e),
          );
          return;
        }

        if (type === 'albedo') {
          const albedo = (await import('@albedo-link/intent')).default;
          const res = await albedo.publicKey({});
          if (!res.pubkey) {
            throw new Error('Albedo authentication cancelled.');
          }
          setAddress(res.pubkey);
          setWalletType('albedo');
          safeSetStorage(LOCAL_STORAGE_CONNECTED_KEY, 'true');
          safeSetStorage(LOCAL_STORAGE_TYPE_KEY, 'albedo');
          safeSetStorage(LOCAL_STORAGE_ADDRESS_KEY, res.pubkey);
          return;
        }

        if (type === 'xbull') {
          const xbull = (
            window as unknown as { xbull?: { getPublicKey: () => Promise<string> } }
          ).xbull;
          if (!xbull) {
            throw new Error('xBull wallet extension not detected in browser.');
          }
          const pubkey = await xbull.getPublicKey();
          setAddress(pubkey);
          setWalletType('xbull');
          safeSetStorage(LOCAL_STORAGE_CONNECTED_KEY, 'true');
          safeSetStorage(LOCAL_STORAGE_TYPE_KEY, 'xbull');
          safeSetStorage(LOCAL_STORAGE_ADDRESS_KEY, pubkey);
          return;
        }

        // Default: Freighter
        const connected = await freighterIsConnected();
        if (!connected) {
          throw new Error('Freighter wallet extension is not installed or available.');
        }

        let result = await freighterRequestAccess();
        if (result.error || !result.address) {
          result = await freighterGetAddress();
        }

        if (result.error || !result.address) {
          throw new Error(result.error ?? 'Access was rejected by the wallet user.');
        }

        setAddress(result.address);
        setWalletType('freighter');
        safeSetStorage(LOCAL_STORAGE_CONNECTED_KEY, 'true');
        safeSetStorage(LOCAL_STORAGE_TYPE_KEY, 'freighter');
        safeSetStorage(LOCAL_STORAGE_ADDRESS_KEY, result.address);

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
        setAddress(null);
        setWalletType(null);
        setSandboxKeypair(null);
        safeRemoveStorage(LOCAL_STORAGE_CONNECTED_KEY);
        safeRemoveStorage(LOCAL_STORAGE_TYPE_KEY);
        safeRemoveStorage(LOCAL_STORAGE_ADDRESS_KEY);
        setError(msg);
      } finally {
        setIsConnecting(false);
      }
    },
    [disconnect],
  );

  const signTx = useCallback(
    async (
      xdr: string,
      networkPassphrase = 'Test SDF Network ; September 2015',
    ): Promise<string> => {
      setError(null);
      if (!address || !walletType) {
        throw new Error('Wallet is not connected.');
      }

      if (walletType === 'watch') {
        throw new Error('Transactions cannot be signed in Watch-Only mode.');
      }

      if (walletType === 'sandbox') {
        if (!sandboxKeypair) {
          throw new Error('Sandbox keypair not initialized.');
        }
        const tx = new Transaction(xdr, networkPassphrase);
        tx.sign(sandboxKeypair);
        return tx.toXDR();
      }

      if (walletType === 'albedo') {
        const albedo = (await import('@albedo-link/intent')).default;
        const res = await albedo.tx({ xdr, network: networkPassphrase });
        return res.signed_envelope_xdr;
      }

      if (walletType === 'xbull') {
        const xbull = (
          window as unknown as {
            xbull?: { signXDR: (xdr: string, opts: { network: string }) => Promise<string> };
          }
        ).xbull;
        if (!xbull) throw new Error('xBull extension unavailable');
        return xbull.signXDR(xdr, { network: networkPassphrase });
      }

      // Freighter
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
    [address, walletType, sandboxKeypair],
  );

  useEffect(() => {
    const wasConnected = safeGetStorage(LOCAL_STORAGE_CONNECTED_KEY) === 'true';
    const savedType = (safeGetStorage(LOCAL_STORAGE_TYPE_KEY) as WalletType) || 'freighter';
    const savedAddr = safeGetStorage(LOCAL_STORAGE_ADDRESS_KEY);

    if (wasConnected && savedType === 'watch' && savedAddr) {
      setAddress(savedAddr);
      setWalletType('watch');
    } else if (wasConnected && savedType === 'freighter') {
      freighterIsConnected().then((ok) => {
        if (ok) {
          freighterGetAddress().then((res) => {
            if (res.address && !res.error) {
              setAddress(res.address);
              setWalletType('freighter');
            }
          });
        }
      });
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        walletType,
        isConnected: Boolean(address),
        isConnecting,
        isWatchOnly: walletType === 'watch',
        error,
        network,
        availableWallets,
        connect,
        disconnect,
        signTx,
        clearError: () => setError(null),
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

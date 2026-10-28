import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { WalletProvider, useWallet } from '../context/WalletContext';

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn().mockResolvedValue(false),
  getAddress: vi.fn().mockResolvedValue({ address: null }),
  requestAccess: vi.fn().mockResolvedValue({ address: null }),
  signTransaction: vi.fn().mockResolvedValue(''),
  getNetworkDetails: vi.fn().mockResolvedValue(null),
}));

describe('WalletContext Multi-Wallet Adapter', () => {
  it('initializes with disconnected state and 5 available wallet engines', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
    expect(result.current.availableWallets).toHaveLength(5);
    expect(result.current.availableWallets.map((w) => w.id)).toEqual([
      'freighter',
      'albedo',
      'xbull',
      'sandbox',
      'watch',
    ]);
  });

  it('connects to Watch-Only mode with valid Stellar G... address', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );

    const { result } = renderHook(() => useWallet(), { wrapper });
    const validAddress = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI';

    await act(async () => {
      await result.current.connect('watch', validAddress);
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isWatchOnly).toBe(true);
    expect(result.current.address).toBe(validAddress);
    expect(result.current.walletType).toBe('watch');

    // Watch mode prevents transaction signing
    await expect(result.current.signTx('AAAA...')).rejects.toThrow(
      'Transactions cannot be signed in Watch-Only mode.',
    );
  });

  it('rejects Watch-Only mode with invalid address format', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.connect('watch', 'invalid_address');
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toContain('valid 56-character Stellar G... public key');
  });

  it('connects to Pre-Funded Sandbox mode generating ephemeral keypair', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.connect('sandbox');
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isWatchOnly).toBe(false);
    expect(result.current.walletType).toBe('sandbox');
    expect(result.current.address).toMatch(/^G[A-Z0-9]{55}$/);

    // Disconnect cleans up state
    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
  });
});

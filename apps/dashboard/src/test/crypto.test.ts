import { describe, it, expect } from 'vitest';
import { ClientCryptoSealer } from '../utils/crypto';

describe('ClientCryptoSealer (AES-256-GCM & SHA-256)', () => {
  it('generates a valid 64-character hex key (256 bits)', async () => {
    const key = await ClientCryptoSealer.generateKeyHex();
    expect(key).toBeTypeOf('string');
    expect(key).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
  });

  it('computes correct SHA-256 hash digests', async () => {
    const hash = await ClientCryptoSealer.sha256Hex('YieldBridge Soroban Protocol');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);

    const hash2 = await ClientCryptoSealer.sha256Hex('YieldBridge Soroban Protocol');
    expect(hash).toBe(hash2);
  });

  it('seals and unseals plaintext data using AES-256-GCM', async () => {
    const key = await ClientCryptoSealer.generateKeyHex();
    const message = 'Confidential Investor Allocation Schedule: Alice=70%, Bob=30%';

    const sealed = await ClientCryptoSealer.sealPayload(message, key);
    expect(sealed).toBeTypeOf('string');
    expect(sealed.length).toBeGreaterThan(message.length);

    const unsealed = await ClientCryptoSealer.unsealPayload(sealed, key);
    expect(unsealed).toBe(message);
  });

  it('rejects unsealing with incorrect key', async () => {
    const key1 = await ClientCryptoSealer.generateKeyHex();
    const key2 = await ClientCryptoSealer.generateKeyHex();
    const message = 'Private Audit Trail Evidence';

    const sealed = await ClientCryptoSealer.sealPayload(message, key1);
    await expect(ClientCryptoSealer.unsealPayload(sealed, key2)).rejects.toThrow();
  });
});

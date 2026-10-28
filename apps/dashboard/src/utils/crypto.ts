/**
 * Client-Side AES-256-GCM Cryptographic Sealing Primitives
 * Built on standard Web Crypto API (crypto.subtle) without third-party dependencies.
 */
export class ClientCryptoSealer {
  /**
   * Generates a random 256-bit cryptographic hex key.
   */
  public static async generateKeyHex(): Promise<string> {
    const key = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
    const exported = await window.crypto.subtle.exportKey('raw', key);
    return Array.from(new Uint8Array(exported))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Computes SHA-256 digest hex of string content.
   */
  public static async sha256Hex(content: string): Promise<string> {
    const enc = new TextEncoder();
    const digest = await window.crypto.subtle.digest('SHA-256', enc.encode(content));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Seals plaintext using AES-256-GCM with a randomized 12-byte IV.
   * Returns base64 encoded string containing [IV (12 bytes) || Ciphertext || Auth Tag (16 bytes)].
   */
  public static async sealPayload(plaintext: string, secretKeyHex: string): Promise<string> {
    const enc = new TextEncoder();
    const rawKey = Uint8Array.from(
      secretKeyHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
    );
    if (rawKey.length !== 32) {
      throw new Error('Secret key must be a 64-character hex string (32 bytes / 256 bits).');
    }

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      rawKey,
      'AES-GCM',
      false,
      ['encrypt'],
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      enc.encode(plaintext),
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    let binary = '';
    for (let i = 0; i < combined.length; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
  }

  /**
   * Unseals base64 encoded AES-256-GCM payload.
   */
  public static async unsealPayload(sealedB64: string, secretKeyHex: string): Promise<string> {
    const binary = atob(sealedB64);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i);
    }

    if (combined.length < 28) {
      throw new Error('Malformed sealed payload: length shorter than IV + auth tag.');
    }

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const rawKey = Uint8Array.from(
      secretKeyHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
    );
    if (rawKey.length !== 32) {
      throw new Error('Secret key must be a 64-character hex string (32 bytes / 256 bits).');
    }

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      rawKey,
      'AES-GCM',
      false,
      ['decrypt'],
    );

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data,
    );

    return new TextDecoder().decode(decrypted);
  }
}

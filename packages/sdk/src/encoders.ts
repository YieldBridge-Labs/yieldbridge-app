import { Address, xdr } from 'stellar-sdk';

const I128_MIN = -(1n << 127n);
const I128_MAX = (1n << 127n) - 1n;
const U128_MAX = (1n << 128n) - 1n;
const U64_MAX = (1n << 64n) - 1n;
const LOW_64_MASK = (1n << 64n) - 1n;

export interface WeightEntry {
  address: string;
  weight: bigint | number;
}

/** Encodes and decodes YieldBridge contract arguments and return values as Soroban ScVal values. */
export class YieldBridgeEncoders {
  // ==========================================
  // Primitive Encoders
  // ==========================================

  public static encodeAddress(addressStr: string): xdr.ScVal {
    if (!addressStr || typeof addressStr !== 'string') {
      throw new TypeError('Address must be a non-empty string');
    }
    return new Address(addressStr).toScVal();
  }

  public static decodeAddress(val: xdr.ScVal): string {
    return Address.fromScVal(val).toString();
  }

  public static encodeU64(value: bigint | number): xdr.ScVal {
    const val = BigInt(value);
    if (val < 0n || val > U64_MAX) {
      throw new RangeError(`Value ${value} is outside the unsigned u64 range [0, 2^64 - 1]`);
    }
    return xdr.ScVal.scvU64(xdr.Uint64.fromString(val.toString()));
  }

  public static decodeU64(val: xdr.ScVal): bigint {
    return BigInt(val.u64().toString());
  }

  public static encodeI128(amount: bigint | number): xdr.ScVal {
    const val = BigInt(amount);
    if (val < I128_MIN || val > I128_MAX) {
      throw new RangeError('Amount is outside the signed i128 range');
    }

    const hi = val >> 64n;
    const lo = val & LOW_64_MASK;
    return xdr.ScVal.scvI128(
      new xdr.Int128Parts({
        hi: xdr.Int64.fromString(hi.toString()),
        lo: xdr.Uint64.fromString(lo.toString()),
      }),
    );
  }

  public static decodeI128(val: xdr.ScVal): bigint {
    const parts = val.i128();
    const hi = BigInt(parts.hi().toString());
    const lo = BigInt(parts.lo().toString());
    return (hi << 64n) + lo;
  }

  public static encodeU128(amount: bigint | number): xdr.ScVal {
    const val = BigInt(amount);
    if (val < 0n || val > U128_MAX) {
      throw new RangeError('Amount is outside the unsigned u128 range');
    }

    const hi = val >> 64n;
    const lo = val & LOW_64_MASK;
    return xdr.ScVal.scvU128(
      new xdr.UInt128Parts({
        hi: xdr.Uint64.fromString(hi.toString()),
        lo: xdr.Uint64.fromString(lo.toString()),
      }),
    );
  }

  public static decodeU128(val: xdr.ScVal): bigint {
    const parts = val.u128();
    const hi = BigInt(parts.hi().toString());
    const lo = BigInt(parts.lo().toString());
    return (hi << 64n) + lo;
  }

  public static encodeBytesN32(bytes: Uint8Array | Buffer | string): xdr.ScVal {
    let buf: Buffer;
    if (typeof bytes === 'string') {
      const cleanHex = bytes.startsWith('0x') ? bytes.slice(2) : bytes;
      if (/^[0-9a-fA-F]{64}$/.test(cleanHex)) {
        buf = Buffer.from(cleanHex, 'hex');
      } else {
        buf = Buffer.from(bytes, 'utf8');
      }
    } else {
      buf = Buffer.from(bytes);
    }

    if (buf.length !== 32) {
      throw new RangeError(`BytesN<32> must be exactly 32 bytes, received ${buf.length}`);
    }
    return xdr.ScVal.scvBytes(buf);
  }

  public static decodeBytesN32(val: xdr.ScVal): Uint8Array {
    return new Uint8Array(val.bytes());
  }

  public static encodeVec(elements: xdr.ScVal[]): xdr.ScVal {
    return xdr.ScVal.scvVec(elements);
  }

  public static decodeVec(val: xdr.ScVal): xdr.ScVal[] {
    return val.vec() ?? [];
  }

  public static encodeSymbol(sym: string): xdr.ScVal {
    return xdr.ScVal.scvSymbol(sym);
  }

  public static encodeString(str: string): xdr.ScVal {
    return xdr.ScVal.scvString(str);
  }

  // ==========================================
  // Contract Method Argument Serializers
  // ==========================================

  /**
   * Serializes arguments for `initialize` method:
   * (admin: Address, token: Address, duration: u64).
   */
  public static encodeInitialize(
    admin: string,
    token: string,
    duration: bigint | number,
  ): xdr.ScVal[] {
    return [
      YieldBridgeEncoders.encodeAddress(admin),
      YieldBridgeEncoders.encodeAddress(token),
      YieldBridgeEncoders.encodeU64(duration),
    ];
  }

  /**
   * Serializes arguments for vault_core `initialize` method:
   * (token: Address, admin: Address, stream_duration: u64).
   */
  public static encodeVaultInitialize(
    token: string,
    admin: string,
    duration: bigint | number,
  ): xdr.ScVal[] {
    return [
      YieldBridgeEncoders.encodeAddress(token),
      YieldBridgeEncoders.encodeAddress(admin),
      YieldBridgeEncoders.encodeU64(duration),
    ];
  }

  /**
   * Serializes arguments for stream_factory `initialize` method:
   * (admin: Address, vault_wasm_hash: BytesN<32>).
   */
  public static encodeFactoryInitialize(
    admin: string,
    vaultWasmHash: Uint8Array | Buffer | string,
  ): xdr.ScVal[] {
    return [
      YieldBridgeEncoders.encodeAddress(admin),
      YieldBridgeEncoders.encodeBytesN32(vaultWasmHash),
    ];
  }

  /**
   * Serializes arguments for `set_weights` method:
   * encoding vectors of Address and u128 share weights.
   */
  public static encodeSetWeights(
    addresses: string[],
    weights: (bigint | number)[],
  ): xdr.ScVal[] {
    if (addresses.length !== weights.length) {
      throw new Error(`Address count (${addresses.length}) does not match weights count (${weights.length})`);
    }
    const addressVals = addresses.map((addr) => YieldBridgeEncoders.encodeAddress(addr));
    const weightVals = weights.map((w) => YieldBridgeEncoders.encodeU128(w));
    return [
      YieldBridgeEncoders.encodeVec(addressVals),
      YieldBridgeEncoders.encodeVec(weightVals),
    ];
  }

  /**
   * Serializes arguments for vault_core `set_shares` method:
   * (investor_address: Address, shares: i128).
   */
  public static encodeSetShares(
    investor: string,
    shares: bigint | number,
  ): xdr.ScVal[] {
    return [
      YieldBridgeEncoders.encodeAddress(investor),
      YieldBridgeEncoders.encodeI128(BigInt(shares)),
    ];
  }

  /**
   * Serializes arguments for `inject` / `inject_yield` method:
   * (amount: i128).
   */
  public static encodeInject(amount: bigint | number): xdr.ScVal[] {
    return [YieldBridgeEncoders.encodeI128(BigInt(amount))];
  }

  public static encodeInjectYield(amount: bigint | number): xdr.ScVal[] {
    return YieldBridgeEncoders.encodeInject(amount);
  }

  /**
   * Serializes arguments for `claim` method:
   * (investor: Address).
   */
  public static encodeClaim(investor: string): xdr.ScVal[] {
    return [YieldBridgeEncoders.encodeAddress(investor)];
  }

  /**
   * Serializes arguments for `claimable` method:
   * (investor: Address).
   */
  public static encodeClaimable(investor: string): xdr.ScVal[] {
    return [YieldBridgeEncoders.encodeAddress(investor)];
  }

  /**
   * Serializes arguments for stream deployment:
   * (salt: BytesN<32>, admin: Address, token: Address, duration: u64).
   */
  public static encodeDeploy(
    salt: Uint8Array | Buffer | string,
    admin: string,
    token: string,
    duration: bigint | number,
  ): xdr.ScVal[] {
    return [
      YieldBridgeEncoders.encodeBytesN32(salt),
      YieldBridgeEncoders.encodeAddress(admin),
      YieldBridgeEncoders.encodeAddress(token),
      YieldBridgeEncoders.encodeU64(duration),
    ];
  }

  /**
   * Serializes arguments for stream_factory `create_vault` method:
   * (salt: BytesN<32>, token: Address, stream_duration: u64).
   */
  public static encodeCreateVault(
    salt: Uint8Array | Buffer | string,
    token: string,
    duration: bigint | number,
  ): xdr.ScVal[] {
    return [
      YieldBridgeEncoders.encodeBytesN32(salt),
      YieldBridgeEncoders.encodeAddress(token),
      YieldBridgeEncoders.encodeU64(duration),
    ];
  }

  /**
   * Serializes arguments for stream_factory `set_vault_wasm_hash`:
   * (vault_wasm_hash: BytesN<32>).
   */
  public static encodeSetVaultWasmHash(
    vaultWasmHash: Uint8Array | Buffer | string,
  ): xdr.ScVal[] {
    return [YieldBridgeEncoders.encodeBytesN32(vaultWasmHash)];
  }

  /**
   * Serializes arguments for stream_factory `vault_for_salt`:
   * (salt: BytesN<32>).
   */
  public static encodeVaultForSalt(salt: Uint8Array | Buffer | string): xdr.ScVal[] {
    return [YieldBridgeEncoders.encodeBytesN32(salt)];
  }
}
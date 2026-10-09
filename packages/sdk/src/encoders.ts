import { Address, xdr } from 'stellar-sdk';

const I128_MIN = -(1n << 127n);
const I128_MAX = (1n << 127n) - 1n;
const LOW_64_MASK = (1n << 64n) - 1n;

/** Encodes YieldBridge contract arguments as Soroban ScVal values. */
export class YieldBridgeEncoders {
  public static encodeAddress(addressStr: string): xdr.ScVal {
    return new Address(addressStr).toScVal();
  }

  public static encodeI128(amount: bigint): xdr.ScVal {
    if (amount < I128_MIN || amount > I128_MAX) {
      throw new RangeError('Amount is outside the signed i128 range');
    }

    const hi = amount >> 64n;
    const lo = amount & LOW_64_MASK;
    return xdr.ScVal.scvI128(
      new xdr.Int128Parts({
        hi: xdr.Int64.fromString(hi.toString()),
        lo: xdr.Uint64.fromString(lo.toString()),
      }),
    );
  }
}
const assert = require('node:assert/strict');
const test = require('node:test');
const { Keypair, xdr } = require('stellar-sdk');
const { YieldBridgeEncoders } = require('../dist');

test('encodes and decodes address roundtrip', () => {
  const kp = Keypair.random();
  const addressStr = kp.publicKey();
  const scVal = YieldBridgeEncoders.encodeAddress(addressStr);

  assert.equal(scVal.switch().name, 'scvAddress');
  const decoded = YieldBridgeEncoders.decodeAddress(scVal);
  assert.equal(decoded, addressStr);
});

test('rejects invalid address values', () => {
  assert.throws(() => YieldBridgeEncoders.encodeAddress(''), TypeError);
  assert.throws(() => YieldBridgeEncoders.encodeAddress(null), TypeError);
});

test('encodes and decodes u64 values', () => {
  const values = [0n, 1n, 86400n, 18446744073709551615n];
  for (const v of values) {
    const scVal = YieldBridgeEncoders.encodeU64(v);
    assert.equal(scVal.switch().name, 'scvU64');
    const decoded = YieldBridgeEncoders.decodeU64(scVal);
    assert.equal(decoded, v);
  }
});

test('rejects u64 values outside range', () => {
  assert.throws(() => YieldBridgeEncoders.encodeU64(-1n), RangeError);
  assert.throws(() => YieldBridgeEncoders.encodeU64(18446744073709551616n), RangeError);
});

test('encodes positive i128 values into signed high and unsigned low words', () => {
  const amount = (1n << 80n) + 7n;
  const scVal = YieldBridgeEncoders.encodeI128(amount);
  const parts = scVal.i128();

  assert.equal(parts.hi().toString(), '65536');
  assert.equal(parts.lo().toString(), '7');
  const decoded = YieldBridgeEncoders.decodeI128(scVal);
  assert.equal(decoded, amount);
});

test('encodes negative i128 values using two\'s-complement words', () => {
  const scVal = YieldBridgeEncoders.encodeI128(-1n);
  const parts = scVal.i128();

  assert.equal(parts.hi().toString(), '-1');
  assert.equal(parts.lo().toString(), '18446744073709551615');
  const decoded = YieldBridgeEncoders.decodeI128(scVal);
  assert.equal(decoded, -1n);
});

test('rejects values outside the i128 range', () => {
  assert.throws(() => YieldBridgeEncoders.encodeI128(1n << 127n), RangeError);
  assert.throws(() => YieldBridgeEncoders.encodeI128(-(1n << 127n) - 1n), RangeError);
});

test('encodes and decodes u128 values', () => {
  const values = [0n, 1000n, (1n << 90n) + 42n, (1n << 128n) - 1n];
  for (const v of values) {
    const scVal = YieldBridgeEncoders.encodeU128(v);
    assert.equal(scVal.switch().name, 'scvU128');
    const decoded = YieldBridgeEncoders.decodeU128(scVal);
    assert.equal(decoded, v);
  }
});

test('rejects u128 values outside range', () => {
  assert.throws(() => YieldBridgeEncoders.encodeU128(-1n), RangeError);
  assert.throws(() => YieldBridgeEncoders.encodeU128(1n << 128n), RangeError);
});

test('encodes and decodes BytesN<32> from Buffer and hex strings', () => {
  const rawBytes = Buffer.alloc(32, 0xab);
  const hexString = rawBytes.toString('hex');
  const hexWithPrefix = `0x${hexString}`;

  const scValFromBuf = YieldBridgeEncoders.encodeBytesN32(rawBytes);
  const scValFromHex = YieldBridgeEncoders.encodeBytesN32(hexString);
  const scValFromPrefix = YieldBridgeEncoders.encodeBytesN32(hexWithPrefix);

  assert.equal(scValFromBuf.switch().name, 'scvBytes');
  assert.deepEqual(YieldBridgeEncoders.decodeBytesN32(scValFromBuf), new Uint8Array(rawBytes));
  assert.deepEqual(YieldBridgeEncoders.decodeBytesN32(scValFromHex), new Uint8Array(rawBytes));
  assert.deepEqual(YieldBridgeEncoders.decodeBytesN32(scValFromPrefix), new Uint8Array(rawBytes));
});

test('rejects BytesN<32> with incorrect length', () => {
  assert.throws(() => YieldBridgeEncoders.encodeBytesN32(Buffer.alloc(31)), RangeError);
  assert.throws(() => YieldBridgeEncoders.encodeBytesN32(Buffer.alloc(33)), RangeError);
  assert.throws(() => YieldBridgeEncoders.encodeBytesN32('abcd'), RangeError);
});

test('encodes initialize arguments correctly: admin (Address), token (Address), duration (u64)', () => {
  const admin = Keypair.random().publicKey();
  const token = Keypair.random().publicKey();
  const duration = 2592000n;

  const args = YieldBridgeEncoders.encodeInitialize(admin, token, duration);
  assert.equal(args.length, 3);
  assert.equal(YieldBridgeEncoders.decodeAddress(args[0]), admin);
  assert.equal(YieldBridgeEncoders.decodeAddress(args[1]), token);
  assert.equal(YieldBridgeEncoders.decodeU64(args[2]), duration);
});

test('encodes vault_core initialize arguments: token (Address), admin (Address), duration (u64)', () => {
  const token = Keypair.random().publicKey();
  const admin = Keypair.random().publicKey();
  const duration = 86400n;

  const args = YieldBridgeEncoders.encodeVaultInitialize(token, admin, duration);
  assert.equal(args.length, 3);
  assert.equal(YieldBridgeEncoders.decodeAddress(args[0]), token);
  assert.equal(YieldBridgeEncoders.decodeAddress(args[1]), admin);
  assert.equal(YieldBridgeEncoders.decodeU64(args[2]), duration);
});

test('encodes set_weights arguments: vectors of Address and u128 share weights', () => {
  const kp1 = Keypair.random().publicKey();
  const kp2 = Keypair.random().publicKey();
  const addresses = [kp1, kp2];
  const weights = [6000n, 4000n];

  const args = YieldBridgeEncoders.encodeSetWeights(addresses, weights);
  assert.equal(args.length, 2);

  const addressVec = YieldBridgeEncoders.decodeVec(args[0]);
  const weightVec = YieldBridgeEncoders.decodeVec(args[1]);
  assert.equal(addressVec.length, 2);
  assert.equal(weightVec.length, 2);

  assert.equal(YieldBridgeEncoders.decodeAddress(addressVec[0]), kp1);
  assert.equal(YieldBridgeEncoders.decodeAddress(addressVec[1]), kp2);
  assert.equal(YieldBridgeEncoders.decodeU128(weightVec[0]), 6000n);
  assert.equal(YieldBridgeEncoders.decodeU128(weightVec[1]), 4000n);
});

test('rejects set_weights if array lengths mismatch', () => {
  const kp1 = Keypair.random().publicKey();
  assert.throws(
    () => YieldBridgeEncoders.encodeSetWeights([kp1], [100n, 200n]),
    /count.*does not match/,
  );
});

test('encodes set_shares arguments: investor (Address), shares (i128)', () => {
  const investor = Keypair.random().publicKey();
  const shares = 500000n;

  const args = YieldBridgeEncoders.encodeSetShares(investor, shares);
  assert.equal(args.length, 2);
  assert.equal(YieldBridgeEncoders.decodeAddress(args[0]), investor);
  assert.equal(YieldBridgeEncoders.decodeI128(args[1]), 500000n);
});

test('encodes inject arguments: amount (i128)', () => {
  const amount = 1000000000000n;
  const args = YieldBridgeEncoders.encodeInject(amount);
  assert.equal(args.length, 1);
  assert.equal(YieldBridgeEncoders.decodeI128(args[0]), amount);

  const yieldArgs = YieldBridgeEncoders.encodeInjectYield(amount);
  assert.equal(yieldArgs.length, 1);
  assert.equal(YieldBridgeEncoders.decodeI128(yieldArgs[0]), amount);
});

test('encodes claim arguments: investor (Address)', () => {
  const investor = Keypair.random().publicKey();
  const args = YieldBridgeEncoders.encodeClaim(investor);
  assert.equal(args.length, 1);
  assert.equal(YieldBridgeEncoders.decodeAddress(args[0]), investor);
});

test('encodes deploy arguments: salt (BytesN<32>), admin (Address), token (Address), duration (u64)', () => {
  const salt = Buffer.alloc(32, 0x42);
  const admin = Keypair.random().publicKey();
  const token = Keypair.random().publicKey();
  const duration = 604800n;

  const args = YieldBridgeEncoders.encodeDeploy(salt, admin, token, duration);
  assert.equal(args.length, 4);
  assert.deepEqual(YieldBridgeEncoders.decodeBytesN32(args[0]), new Uint8Array(salt));
  assert.equal(YieldBridgeEncoders.decodeAddress(args[1]), admin);
  assert.equal(YieldBridgeEncoders.decodeAddress(args[2]), token);
  assert.equal(YieldBridgeEncoders.decodeU64(args[3]), duration);
});

test('encodes stream_factory create_vault arguments: salt (BytesN<32>), token (Address), duration (u64)', () => {
  const salt = Buffer.alloc(32, 0x11);
  const token = Keypair.random().publicKey();
  const duration = 1209600n;

  const args = YieldBridgeEncoders.encodeCreateVault(salt, token, duration);
  assert.equal(args.length, 3);
  assert.deepEqual(YieldBridgeEncoders.decodeBytesN32(args[0]), new Uint8Array(salt));
  assert.equal(YieldBridgeEncoders.decodeAddress(args[1]), token);
  assert.equal(YieldBridgeEncoders.decodeU64(args[2]), duration);
});
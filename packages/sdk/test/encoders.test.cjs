const assert = require('node:assert/strict');
const test = require('node:test');
const { YieldBridgeEncoders } = require('../dist');

test('encodes positive i128 values into signed high and unsigned low words', () => {
  const parts = YieldBridgeEncoders.encodeI128((1n << 80n) + 7n).i128();

  assert.equal(parts.hi().toString(), '65536');
  assert.equal(parts.lo().toString(), '7');
});

test('encodes negative i128 values using two\'s-complement words', () => {
  const parts = YieldBridgeEncoders.encodeI128(-1n).i128();

  assert.equal(parts.hi().toString(), '-1');
  assert.equal(parts.lo().toString(), '18446744073709551615');
});

test('rejects values outside the i128 range', () => {
  assert.throws(() => YieldBridgeEncoders.encodeI128(1n << 127n), RangeError);
  assert.throws(() => YieldBridgeEncoders.encodeI128(-(1n << 127n) - 1n), RangeError);
});
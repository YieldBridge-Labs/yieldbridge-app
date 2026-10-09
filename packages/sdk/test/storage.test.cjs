const assert = require('node:assert/strict');
const test = require('node:test');
const { Keypair, xdr } = require('stellar-sdk');
const { YieldBridgeStorage, YieldBridgeEncoders } = require('../dist');

const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';

test('builds valid State and Investor ledger keys', () => {
  const stateKey = YieldBridgeStorage.buildStateLedgerKey(CONTRACT_ID);
  assert.equal(stateKey.switch().name, 'contractData');
  assert.ok(stateKey.toXDR().length > 0);

  const kp = Keypair.random();
  const investorKey = YieldBridgeStorage.buildInvestorLedgerKey(CONTRACT_ID, kp.publicKey());
  assert.equal(investorKey.switch().name, 'contractData');
  assert.ok(investorKey.toXDR().length > 0);
});

test('parses VaultState struct from ScMap correctly', () => {
  const token = Keypair.random().publicKey();
  const admin = Keypair.random().publicKey();

  const entries = [
    new xdr.ScMapEntry({
      key: YieldBridgeEncoders.encodeSymbol('token'),
      val: YieldBridgeEncoders.encodeAddress(token),
    }),
    new xdr.ScMapEntry({
      key: YieldBridgeEncoders.encodeSymbol('admin'),
      val: YieldBridgeEncoders.encodeAddress(admin),
    }),
    new xdr.ScMapEntry({
      key: YieldBridgeEncoders.encodeSymbol('stream_duration'),
      val: YieldBridgeEncoders.encodeU64(86400n),
    }),
    new xdr.ScMapEntry({
      key: YieldBridgeEncoders.encodeSymbol('total_shares'),
      val: YieldBridgeEncoders.encodeI128(1000000n),
    }),
    new xdr.ScMapEntry({
      key: YieldBridgeEncoders.encodeSymbol('reward_per_share'),
      val: YieldBridgeEncoders.encodeI128(500n),
    }),
    new xdr.ScMapEntry({
      key: YieldBridgeEncoders.encodeSymbol('reward_rate_scaled'),
      val: YieldBridgeEncoders.encodeI128(12345678n),
    }),
    new xdr.ScMapEntry({
      key: YieldBridgeEncoders.encodeSymbol('last_update_time'),
      val: YieldBridgeEncoders.encodeU64(1000n),
    }),
    new xdr.ScMapEntry({
      key: YieldBridgeEncoders.encodeSymbol('period_finish'),
      val: YieldBridgeEncoders.encodeU64(87400n),
    }),
    new xdr.ScMapEntry({
      key: YieldBridgeEncoders.encodeSymbol('total_funded'),
      val: YieldBridgeEncoders.encodeI128(2000000n),
    }),
    new xdr.ScMapEntry({
      key: YieldBridgeEncoders.encodeSymbol('total_claimed'),
      val: YieldBridgeEncoders.encodeI128(150000n),
    }),
    new xdr.ScMapEntry({
      key: YieldBridgeEncoders.encodeSymbol('entered'),
      val: xdr.ScVal.scvBool(false),
    }),
  ];

  const scMap = xdr.ScVal.scvMap(entries);
  const parsed = YieldBridgeStorage.parseVaultState(scMap);

  assert.ok(parsed);
  assert.equal(parsed.token, token);
  assert.equal(parsed.admin, admin);
  assert.equal(parsed.streamDuration, 86400n);
  assert.equal(parsed.totalShares, 1000000n);
  assert.equal(parsed.totalClaimed, 150000n);
  assert.equal(parsed.entered, false);
});

test('parses Investor struct from ScMap correctly', () => {
  const entries = [
    new xdr.ScMapEntry({
      key: YieldBridgeEncoders.encodeSymbol('shares'),
      val: YieldBridgeEncoders.encodeI128(50000n),
    }),
    new xdr.ScMapEntry({
      key: YieldBridgeEncoders.encodeSymbol('reward_debt_scaled'),
      val: YieldBridgeEncoders.encodeI128(25000000n),
    }),
    new xdr.ScMapEntry({
      key: YieldBridgeEncoders.encodeSymbol('accrued_scaled'),
      val: YieldBridgeEncoders.encodeI128(12000000n),
    }),
  ];

  const scMap = xdr.ScVal.scvMap(entries);
  const parsed = YieldBridgeStorage.parseInvestor(scMap);

  assert.ok(parsed);
  assert.equal(parsed.shares, 50000n);
  assert.equal(parsed.rewardDebtScaled, 25000000n);
  assert.equal(parsed.accruedScaled, 12000000n);
});

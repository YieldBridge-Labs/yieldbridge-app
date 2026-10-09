const assert = require('node:assert/strict');
const test = require('node:test');
const { Account, Keypair, Networks } = require('stellar-sdk');
const { YieldBridgeTransactionBuilders } = require('../dist');

const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
const FACTORY_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';

function createMockAccount() {
  const kp = Keypair.random();
  return new Account(kp.publicKey(), '100');
}

test('builds valid initialize transaction with XDR', () => {
  const account = createMockAccount();
  const admin = Keypair.random().publicKey();
  const token = Keypair.random().publicKey();

  const tx = YieldBridgeTransactionBuilders.buildInitializeTx({
    contractId: CONTRACT_ID,
    admin,
    token,
    duration: 86400n,
    sourceAccount: account,
  });

  assert.ok(tx);
  assert.equal(tx.operations.length, 1);
  const xdrB64 = tx.toXDR();
  assert.ok(xdrB64.length > 0);
});

test('builds valid vault initialize transaction', () => {
  const account = createMockAccount();
  const token = Keypair.random().publicKey();
  const admin = Keypair.random().publicKey();

  const tx = YieldBridgeTransactionBuilders.buildVaultInitializeTx({
    contractId: CONTRACT_ID,
    token,
    admin,
    duration: 604800n,
    sourceAccount: account,
  });

  assert.ok(tx);
  assert.equal(tx.operations.length, 1);
  assert.ok(tx.toXDR().length > 0);
});

test('builds valid set_weights and set_shares transactions', () => {
  const account = createMockAccount();
  const inv1 = Keypair.random().publicKey();
  const inv2 = Keypair.random().publicKey();

  const weightsTx = YieldBridgeTransactionBuilders.buildSetWeightsTx({
    contractId: CONTRACT_ID,
    addresses: [inv1, inv2],
    weights: [7000n, 3000n],
    sourceAccount: account,
  });
  assert.equal(weightsTx.operations.length, 1);
  assert.ok(weightsTx.toXDR().length > 0);

  const sharesTx = YieldBridgeTransactionBuilders.buildSetSharesTx({
    contractId: CONTRACT_ID,
    investor: inv1,
    shares: 7000n,
    sourceAccount: account,
  });
  assert.equal(sharesTx.operations.length, 1);
  assert.ok(sharesTx.toXDR().length > 0);
});

test('builds valid inject transaction', () => {
  const account = createMockAccount();
  const tx = YieldBridgeTransactionBuilders.buildInjectTx({
    contractId: CONTRACT_ID,
    amount: 5000000000n,
    sourceAccount: account,
  });

  assert.equal(tx.operations.length, 1);
  assert.ok(tx.toXDR().length > 0);
});

test('builds valid claim transaction', () => {
  const account = createMockAccount();
  const investor = Keypair.random().publicKey();
  const tx = YieldBridgeTransactionBuilders.buildClaimTx({
    contractId: CONTRACT_ID,
    investor,
    sourceAccount: account,
  });

  assert.equal(tx.operations.length, 1);
  assert.ok(tx.toXDR().length > 0);
});

test('builds valid deploy and create_vault transactions', () => {
  const account = createMockAccount();
  const admin = Keypair.random().publicKey();
  const token = Keypair.random().publicKey();
  const salt = Buffer.alloc(32, 0x55);

  const deployTx = YieldBridgeTransactionBuilders.buildDeployTx({
    factoryId: FACTORY_ID,
    salt,
    admin,
    token,
    duration: 2592000n,
    sourceAccount: account,
  });
  assert.equal(deployTx.operations.length, 1);
  assert.ok(deployTx.toXDR().length > 0);

  const createVaultTx = YieldBridgeTransactionBuilders.buildCreateVaultTx({
    factoryId: FACTORY_ID,
    salt,
    token,
    duration: 2592000n,
    sourceAccount: account,
  });
  assert.equal(createVaultTx.operations.length, 1);
  assert.ok(createVaultTx.toXDR().length > 0);
});

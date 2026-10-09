const assert = require('node:assert/strict');
const test = require('node:test');
const { Keypair } = require('stellar-sdk');
const { VaultContract, StreamFactoryContract, YieldBridgeSDK } = require('../dist');

// Valid 56-char test contract addresses
const VAULT_ADDRESS = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
const FACTORY_ADDRESS = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';

test('VaultContract builds valid initialize operation', () => {
  const vault = new VaultContract(VAULT_ADDRESS);
  const token = Keypair.random().publicKey();
  const admin = Keypair.random().publicKey();
  const op = vault.initialize(token, admin, 86400n);

  assert.ok(op);
  const xdrBytes = op.toXDR('base64');
  assert.ok(xdrBytes.length > 0);
});

test('VaultContract builds valid setWeights and setShares operations', () => {
  const vault = new VaultContract(VAULT_ADDRESS);
  const inv1 = Keypair.random().publicKey();
  const inv2 = Keypair.random().publicKey();

  const setWeightsOp = vault.setWeights([inv1, inv2], [5000n, 5000n]);
  assert.ok(setWeightsOp.toXDR('base64').length > 0);

  const setSharesOp = vault.setShares(inv1, 5000n);
  assert.ok(setSharesOp.toXDR('base64').length > 0);
});

test('VaultContract builds valid inject, claim, claimable, and configuration operations', () => {
  const vault = new VaultContract(VAULT_ADDRESS);
  const investor = Keypair.random().publicKey();

  const injectOp = vault.inject(1000000000n);
  assert.ok(injectOp.toXDR('base64').length > 0);

  const claimOp = vault.claim(investor);
  assert.ok(claimOp.toXDR('base64').length > 0);

  const claimableOp = vault.claimable(investor);
  assert.ok(claimableOp.toXDR('base64').length > 0);

  const configOp = vault.configuration();
  assert.ok(configOp.toXDR('base64').length > 0);
});

test('StreamFactoryContract builds valid factory operations', () => {
  const factory = new StreamFactoryContract(FACTORY_ADDRESS);
  const admin = Keypair.random().publicKey();
  const token = Keypair.random().publicKey();
  const wasmHash = Buffer.alloc(32, 0xef);
  const salt = Buffer.alloc(32, 0x12);

  const initOp = factory.initialize(admin, wasmHash);
  assert.ok(initOp.toXDR('base64').length > 0);

  const setHashOp = factory.setVaultWasmHash(wasmHash);
  assert.ok(setHashOp.toXDR('base64').length > 0);

  const createOp = factory.createVault(salt, token, 604800n);
  assert.ok(createOp.toXDR('base64').length > 0);

  const deployOp = factory.deploy(salt, admin, token, 604800n);
  assert.ok(deployOp.toXDR('base64').length > 0);

  const vaultSaltOp = factory.vaultForSalt(salt);
  assert.ok(vaultSaltOp.toXDR('base64').length > 0);

  const configOp = factory.configuration();
  assert.ok(configOp.toXDR('base64').length > 0);
});

test('YieldBridgeSDK instantiates vault and factory clients with full method suite', () => {
  const sdk = new YieldBridgeSDK();
  const vaultClient = sdk.getVault(VAULT_ADDRESS);
  const factoryClient = sdk.getFactory(FACTORY_ADDRESS);

  assert.equal(vaultClient.vaultAddress, VAULT_ADDRESS);
  assert.equal(factoryClient.factoryAddress, FACTORY_ADDRESS);

  assert.equal(typeof vaultClient.buildInitializeTx, 'function');
  assert.equal(typeof vaultClient.buildVaultInitializeTx, 'function');
  assert.equal(typeof vaultClient.buildSetWeightsTx, 'function');
  assert.equal(typeof vaultClient.buildClaimTx, 'function');
  assert.equal(typeof vaultClient.buildInjectTx, 'function');
  assert.equal(typeof vaultClient.buildSetSharesTx, 'function');
  assert.equal(typeof vaultClient.getVaultState, 'function');
  assert.equal(typeof vaultClient.getInvestorRecord, 'function');

  assert.equal(typeof factoryClient.buildDeployTx, 'function');
  assert.equal(typeof factoryClient.buildCreateVaultTx, 'function');
  assert.equal(typeof factoryClient.submitSignedTransaction, 'function');
});

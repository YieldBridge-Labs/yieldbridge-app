import {
  Account,
  Contract,
  Networks,
  Transaction,
  TransactionBuilder,
  rpc,
  xdr,
} from 'stellar-sdk';
import { VaultContract, StreamFactoryContract } from './contracts';
import { YieldBridgeEncoders } from './encoders';
import {
  YieldBridgeStorage,
  type VaultStateRecord,
  type InvestorRecord,
} from './storage';

export const DEFAULT_SIMULATION_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
export const DEFAULT_TESTNET_RPC = 'https://soroban-testnet.stellar.org';
export const DEFAULT_NETWORK_PASSPHRASE = Networks.TESTNET;

export interface VaultConfiguration {
  admin: string;
  token: string;
  streamDuration: bigint;
}

export interface FactoryConfiguration {
  admin: string;
  vaultWasmHash: string;
}

export interface ClientConfig {
  rpcUrl?: string;
  networkPassphrase?: string;
}

/** Client for interacting with deployed `vault_core` contracts. */
export class VaultClient {
  public readonly server: rpc.Server;
  public readonly contract: VaultContract;
  public readonly networkPassphrase: string;

  constructor(
    public readonly vaultAddress: string,
    config: ClientConfig = {},
  ) {
    this.server = new rpc.Server(config.rpcUrl ?? DEFAULT_TESTNET_RPC);
    this.networkPassphrase = config.networkPassphrase ?? DEFAULT_NETWORK_PASSPHRASE;
    this.contract = new VaultContract(vaultAddress);
  }

  /**
   * Retrieves the vault's static configuration from storage/contract.
   */
  public async getConfiguration(): Promise<VaultConfiguration> {
    const op = this.contract.configuration();
    const sim = await this.simulateOperation(op);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
      throw new Error(`Failed to simulate configuration query: ${JSON.stringify(sim)}`);
    }

    const vec = sim.result.retval.vec();
    if (!vec || vec.length < 3) {
      throw new Error('Malformed configuration return value from vault');
    }

    return {
      admin: YieldBridgeEncoders.decodeAddress(vec[0]),
      token: YieldBridgeEncoders.decodeAddress(vec[1]),
      streamDuration: YieldBridgeEncoders.decodeU64(vec[2]),
    };
  }

  /**
   * Queries pending claimable yield for an investor without submitting a transaction.
   */
  public async getClaimable(investorAddress: string): Promise<bigint> {
    const op = this.contract.claimable(investorAddress);
    const sim = await this.simulateOperation(op);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
      throw new Error(`Failed to query claimable balance for ${investorAddress}`);
    }
    return YieldBridgeEncoders.decodeI128(sim.result.retval);
  }

  /**
   * Reads standard SEP-41 token balance for an address (vault or investor).
   */
  public async getTokenBalance(tokenContractAddress: string, holderAddress: string): Promise<bigint> {
    const tokenContract = new Contract(tokenContractAddress);
    const op = tokenContract.call('balance', YieldBridgeEncoders.encodeAddress(holderAddress));
    const sim = await this.simulateOperation(op);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
      return 0n;
    }
    return YieldBridgeEncoders.decodeI128(sim.result.retval);
  }

  /**
   * Reads persistent on-chain VaultState record from Soroban ledger storage via getLedgerEntries.
   */
  public async getVaultState(): Promise<VaultStateRecord | null> {
    const key = YieldBridgeStorage.buildStateLedgerKey(this.vaultAddress);
    const resp = await this.server.getLedgerEntries(key);
    if (!resp.entries || resp.entries.length === 0) {
      return null;
    }
    const contractData = resp.entries[0].val.contractData();
    return YieldBridgeStorage.parseVaultState(contractData.val());
  }

  /**
   * Reads persistent on-chain Investor record from Soroban ledger storage via getLedgerEntries.
   */
  public async getInvestorRecord(investorAddress: string): Promise<InvestorRecord | null> {
    const key = YieldBridgeStorage.buildInvestorLedgerKey(this.vaultAddress, investorAddress);
    const resp = await this.server.getLedgerEntries(key);
    if (!resp.entries || resp.entries.length === 0) {
      return null;
    }
    const contractData = resp.entries[0].val.contractData();
    return YieldBridgeStorage.parseInvestor(contractData.val());
  }

  /**
   * Builds and simulates a prepared initialize transaction for the vault.
   */
  public async buildInitializeTx(
    adminAddress: string,
    tokenAddress: string,
    duration: bigint | number,
    options: { fee?: string; timeout?: number } = {},
  ): Promise<Transaction> {
    const op = this.contract.initializeWithAdmin(adminAddress, tokenAddress, duration);
    return this.buildAndPrepareTransaction(adminAddress, op, options);
  }

  /**
   * Builds and simulates a prepared vault_core initialize transaction (token, admin, duration).
   */
  public async buildVaultInitializeTx(
    tokenAddress: string,
    adminAddress: string,
    duration: bigint | number,
    options: { fee?: string; timeout?: number } = {},
  ): Promise<Transaction> {
    const op = this.contract.vaultInitialize(tokenAddress, adminAddress, duration);
    return this.buildAndPrepareTransaction(adminAddress, op, options);
  }

  /**
   * Builds and simulates a prepared set_weights transaction for batch weight configuration.
   */
  public async buildSetWeightsTx(
    adminAddress: string,
    addresses: string[],
    weights: (bigint | number)[],
    options: { fee?: string; timeout?: number } = {},
  ): Promise<Transaction> {
    const op = this.contract.setWeights(addresses, weights);
    return this.buildAndPrepareTransaction(adminAddress, op, options);
  }

  /**
   * Builds and simulates a prepared claim transaction ready to be signed.
   */
  public async buildClaimTx(
    investorAddress: string,
    options: { fee?: string; timeout?: number } = {},
  ): Promise<Transaction> {
    const op = this.contract.claim(investorAddress);
    return this.buildAndPrepareTransaction(investorAddress, op, options);
  }

  /**
   * Builds and simulates a prepared inject_yield transaction ready to be signed.
   */
  public async buildInjectTx(
    adminAddress: string,
    amount: bigint | number,
    options: { fee?: string; timeout?: number } = {},
  ): Promise<Transaction> {
    const op = this.contract.injectYield(amount);
    return this.buildAndPrepareTransaction(adminAddress, op, options);
  }

  /**
   * Builds and simulates a prepared set_shares transaction.
   */
  public async buildSetSharesTx(
    adminAddress: string,
    investorAddress: string,
    shares: bigint | number,
    options: { fee?: string; timeout?: number } = {},
  ): Promise<Transaction> {
    const op = this.contract.setShares(investorAddress, shares);
    return this.buildAndPrepareTransaction(adminAddress, op, options);
  }

  /**
   * Submits a signed transaction XDR string to the Soroban RPC network
   * and polls until finalized or failed.
   */
  public async submitSignedTransaction(
    signedTxXdr: string,
    pollIntervalMs = 1000,
    maxWaitMs = 30000,
  ): Promise<rpc.Api.GetTransactionResponse> {
    const tx = new Transaction(signedTxXdr, this.networkPassphrase);
    const response = await this.server.sendTransaction(tx);

    if (response.status === 'ERROR') {
      throw new Error(`Transaction submission error: ${JSON.stringify(response.errorResult)}`);
    }

    const hash = response.hash;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const result = await this.server.getTransaction(hash);
      if (result.status === 'SUCCESS' || result.status === 'FAILED') {
        return result;
      }
      await new Promise((res) => setTimeout(res, pollIntervalMs));
    }

    throw new Error(`Transaction ${hash} polling timed out after ${maxWaitMs}ms`);
  }

  protected async simulateOperation(op: xdr.Operation): Promise<rpc.Api.SimulateTransactionResponse> {
    const account = new Account(DEFAULT_SIMULATION_ACCOUNT, '0');
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    return this.server.simulateTransaction(tx);
  }

  protected async buildAndPrepareTransaction(
    sourceAddress: string,
    op: xdr.Operation,
    options: { fee?: string; timeout?: number } = {},
  ): Promise<Transaction> {
    const accountResp = await this.server.getAccount(sourceAddress);
    const tx = new TransactionBuilder(accountResp, {
      fee: options.fee ?? '10000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(options.timeout ?? 60)
      .build();

    return this.server.prepareTransaction(tx);
  }
}

/** Client for interacting with deployed `stream_factory` contracts. */
export class StreamFactoryClient {
  public readonly server: rpc.Server;
  public readonly contract: StreamFactoryContract;
  public readonly networkPassphrase: string;

  constructor(
    public readonly factoryAddress: string,
    config: ClientConfig = {},
  ) {
    this.server = new rpc.Server(config.rpcUrl ?? DEFAULT_TESTNET_RPC);
    this.networkPassphrase = config.networkPassphrase ?? DEFAULT_NETWORK_PASSPHRASE;
    this.contract = new StreamFactoryContract(factoryAddress);
  }

  /**
   * Retrieves factory admin and registered vault code hash.
   */
  public async getConfiguration(): Promise<FactoryConfiguration> {
    const op = this.contract.configuration();
    const sim = await this.simulateOperation(op);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
      throw new Error(`Failed to simulate factory configuration query: ${JSON.stringify(sim)}`);
    }

    const vec = sim.result.retval.vec();
    if (!vec || vec.length < 2) {
      throw new Error('Malformed configuration return value from factory');
    }

    return {
      admin: YieldBridgeEncoders.decodeAddress(vec[0]),
      vaultWasmHash: Buffer.from(YieldBridgeEncoders.decodeBytesN32(vec[1])).toString('hex'),
    };
  }

  /**
   * Queries the vault address associated with a deployment salt.
   */
  public async getVaultForSalt(salt: Uint8Array | Buffer | string): Promise<string | null> {
    const op = this.contract.vaultForSalt(salt);
    const sim = await this.simulateOperation(op);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
      return null;
    }
    const val = sim.result.retval;
    if (val.switch() === xdr.ScValType.scvVoid()) {
      return null;
    }
    return YieldBridgeEncoders.decodeAddress(val);
  }

  /**
   * Builds and simulates a prepared deploy transaction to spawn a new vault via stream_factory.
   */
  public async buildDeployTx(
    adminAddress: string,
    salt: Uint8Array | Buffer | string,
    tokenAddress: string,
    duration: bigint | number,
    options: { fee?: string; timeout?: number } = {},
  ): Promise<Transaction> {
    const op = this.contract.deploy(salt, adminAddress, tokenAddress, duration);
    return this.buildAndPrepareTransaction(adminAddress, op, options);
  }

  /**
   * Builds and simulates a prepared create_vault transaction on stream_factory.
   */
  public async buildCreateVaultTx(
    sourceAddress: string,
    salt: Uint8Array | Buffer | string,
    tokenAddress: string,
    duration: bigint | number,
    options: { fee?: string; timeout?: number } = {},
  ): Promise<Transaction> {
    const op = this.contract.createVault(salt, tokenAddress, duration);
    return this.buildAndPrepareTransaction(sourceAddress, op, options);
  }

  /**
   * Submits a signed transaction XDR string to the Soroban RPC network
   * and polls until finalized or failed.
   */
  public async submitSignedTransaction(
    signedTxXdr: string,
    pollIntervalMs = 1000,
    maxWaitMs = 30000,
  ): Promise<rpc.Api.GetTransactionResponse> {
    const tx = new Transaction(signedTxXdr, this.networkPassphrase);
    const response = await this.server.sendTransaction(tx);

    if (response.status === 'ERROR') {
      throw new Error(`Transaction submission error: ${JSON.stringify(response.errorResult)}`);
    }

    const hash = response.hash;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const result = await this.server.getTransaction(hash);
      if (result.status === 'SUCCESS' || result.status === 'FAILED') {
        return result;
      }
      await new Promise((res) => setTimeout(res, pollIntervalMs));
    }

    throw new Error(`Transaction ${hash} polling timed out after ${maxWaitMs}ms`);
  }

  protected async simulateOperation(op: xdr.Operation): Promise<rpc.Api.SimulateTransactionResponse> {
    const account = new Account(DEFAULT_SIMULATION_ACCOUNT, '0');
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    return this.server.simulateTransaction(tx);
  }

  protected async buildAndPrepareTransaction(
    sourceAddress: string,
    op: xdr.Operation,
    options: { fee?: string; timeout?: number } = {},
  ): Promise<Transaction> {
    const accountResp = await this.server.getAccount(sourceAddress);
    const tx = new TransactionBuilder(accountResp, {
      fee: options.fee ?? '10000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(options.timeout ?? 60)
      .build();

    return this.server.prepareTransaction(tx);
  }
}

/** Root SDK client providing access to YieldBridge contracts. */
export class YieldBridgeSDK {
  public readonly rpcUrl: string;
  public readonly networkPassphrase: string;
  public readonly server: rpc.Server;

  constructor(config: ClientConfig = {}) {
    this.rpcUrl = config.rpcUrl ?? DEFAULT_TESTNET_RPC;
    this.networkPassphrase = config.networkPassphrase ?? DEFAULT_NETWORK_PASSPHRASE;
    this.server = new rpc.Server(this.rpcUrl);
  }

  public getVault(vaultAddress: string): VaultClient {
    return new VaultClient(vaultAddress, {
      rpcUrl: this.rpcUrl,
      networkPassphrase: this.networkPassphrase,
    });
  }

  public getFactory(factoryAddress: string): StreamFactoryClient {
    return new StreamFactoryClient(factoryAddress, {
      rpcUrl: this.rpcUrl,
      networkPassphrase: this.networkPassphrase,
    });
  }
}

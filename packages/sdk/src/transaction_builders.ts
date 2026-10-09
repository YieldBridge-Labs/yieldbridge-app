import {
  Account,
  Contract,
  Networks,
  Transaction,
  TransactionBuilder,
  xdr,
} from 'stellar-sdk';
import { YieldBridgeEncoders } from './encoders';

export interface BaseTxParams {
  sourceAccount: Account;
  fee?: string;
  timeout?: number;
  networkPassphrase?: string;
}

export interface InitializeTxParams extends BaseTxParams {
  contractId: string;
  admin: string;
  token: string;
  duration: bigint | number;
}

export interface VaultInitializeTxParams extends BaseTxParams {
  contractId: string;
  token: string;
  admin: string;
  duration: bigint | number;
}

export interface SetWeightsTxParams extends BaseTxParams {
  contractId: string;
  addresses: string[];
  weights: (bigint | number)[];
}

export interface SetSharesTxParams extends BaseTxParams {
  contractId: string;
  investor: string;
  shares: bigint | number;
}

export interface InjectTxParams extends BaseTxParams {
  contractId: string;
  amount: bigint | number;
}

export interface ClaimTxParams extends BaseTxParams {
  contractId: string;
  investor: string;
}

export interface DeployTxParams extends BaseTxParams {
  factoryId: string;
  salt: Uint8Array | Buffer | string;
  admin: string;
  token: string;
  duration: bigint | number;
}

export interface CreateVaultTxParams extends BaseTxParams {
  factoryId: string;
  salt: Uint8Array | Buffer | string;
  token: string;
  duration: bigint | number;
}

const DEFAULT_FEE = '10000';
const DEFAULT_TIMEOUT = 60;
const DEFAULT_PASSPHRASE = Networks.TESTNET;

/** Factory for building raw Soroban Transactions with explicit XDR encoding. */
export class YieldBridgeTransactionBuilders {
  /**
   * Builds a Transaction for initializing vault contract:
   * (admin: Address, token: Address, duration: u64).
   */
  public static buildInitializeTx(params: InitializeTxParams): Transaction {
    const contract = new Contract(params.contractId);
    const args = YieldBridgeEncoders.encodeInitialize(
      params.admin,
      params.token,
      params.duration,
    );
    const op = contract.call('initialize', ...args);
    return this.createTransaction(params, op);
  }

  /**
   * Builds a Transaction for vault_core initialization:
   * (token: Address, admin: Address, duration: u64).
   */
  public static buildVaultInitializeTx(params: VaultInitializeTxParams): Transaction {
    const contract = new Contract(params.contractId);
    const args = YieldBridgeEncoders.encodeVaultInitialize(
      params.token,
      params.admin,
      params.duration,
    );
    const op = contract.call('initialize', ...args);
    return this.createTransaction(params, op);
  }

  /**
   * Builds a Transaction for setting investor weights:
   * (addresses: Vec<Address>, weights: Vec<u128>).
   */
  public static buildSetWeightsTx(params: SetWeightsTxParams): Transaction {
    const contract = new Contract(params.contractId);
    const args = YieldBridgeEncoders.encodeSetWeights(params.addresses, params.weights);
    const op = contract.call('set_weights', ...args);
    return this.createTransaction(params, op);
  }

  /**
   * Builds a Transaction for updating investor shares in vault_core:
   * (investor: Address, shares: i128).
   */
  public static buildSetSharesTx(params: SetSharesTxParams): Transaction {
    const contract = new Contract(params.contractId);
    const args = YieldBridgeEncoders.encodeSetShares(params.investor, params.shares);
    const op = contract.call('set_shares', ...args);
    return this.createTransaction(params, op);
  }

  /**
   * Builds a Transaction for injecting reward funding into the vault:
   * (amount: i128).
   */
  public static buildInjectTx(params: InjectTxParams): Transaction {
    const contract = new Contract(params.contractId);
    const args = YieldBridgeEncoders.encodeInject(params.amount);
    const op = contract.call('inject_yield', ...args);
    return this.createTransaction(params, op);
  }

  /**
   * Builds a Transaction for claiming accrued yield:
   * (investor: Address).
   */
  public static buildClaimTx(params: ClaimTxParams): Transaction {
    const contract = new Contract(params.contractId);
    const args = YieldBridgeEncoders.encodeClaim(params.investor);
    const op = contract.call('claim', ...args);
    return this.createTransaction(params, op);
  }

  /**
   * Builds a Transaction for deploying a vault through stream_factory:
   * (salt: BytesN<32>, admin: Address, token: Address, duration: u64).
   */
  public static buildDeployTx(params: DeployTxParams): Transaction {
    const contract = new Contract(params.factoryId);
    const args = YieldBridgeEncoders.encodeDeploy(
      params.salt,
      params.admin,
      params.token,
      params.duration,
    );
    const op = contract.call('deploy', ...args);
    return this.createTransaction(params, op);
  }

  /**
   * Builds a Transaction for factory create_vault:
   * (salt: BytesN<32>, token: Address, duration: u64).
   */
  public static buildCreateVaultTx(params: CreateVaultTxParams): Transaction {
    const contract = new Contract(params.factoryId);
    const args = YieldBridgeEncoders.encodeCreateVault(
      params.salt,
      params.token,
      params.duration,
    );
    const op = contract.call('create_vault', ...args);
    return this.createTransaction(params, op);
  }

  private static createTransaction(params: BaseTxParams, op: xdr.Operation): Transaction {
    return new TransactionBuilder(params.sourceAccount, {
      fee: params.fee ?? DEFAULT_FEE,
      networkPassphrase: params.networkPassphrase ?? DEFAULT_PASSPHRASE,
    })
      .addOperation(op)
      .setTimeout(params.timeout ?? DEFAULT_TIMEOUT)
      .build();
  }
}

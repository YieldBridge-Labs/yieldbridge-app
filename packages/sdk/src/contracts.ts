import { Contract, xdr } from 'stellar-sdk';
import { YieldBridgeEncoders } from './encoders';

/** Contract call builder for YieldBridge `vault_core`. */
export class VaultContract {
  public readonly contract: Contract;

  constructor(public readonly address: string) {
    this.contract = new Contract(address);
  }

  /**
   * Initializes the vault contract.
   * Standard order: (token: Address, admin: Address, duration: u64).
   */
  public initialize(
    token: string,
    admin: string,
    duration: bigint | number,
  ): xdr.Operation {
    const args = YieldBridgeEncoders.encodeVaultInitialize(token, admin, duration);
    return this.contract.call('initialize', ...args);
  }

  /**
   * Alias for vault_core initialization with (token: Address, admin: Address, duration: u64).
   */
  public vaultInitialize(
    token: string,
    admin: string,
    duration: bigint | number,
  ): xdr.Operation {
    return this.initialize(token, admin, duration);
  }

  /**
   * Initializes the vault contract with (admin: Address, token: Address, duration: u64).
   */
  public initializeWithAdmin(
    admin: string,
    token: string,
    duration: bigint | number,
  ): xdr.Operation {
    const args = YieldBridgeEncoders.encodeInitialize(admin, token, duration);
    return this.contract.call('initialize', ...args);
  }

  /**
   * Updates an investor's share allocation.
   * (investor_address: Address, shares: i128).
   */
  public setShares(
    investor: string,
    shares: bigint | number,
  ): xdr.Operation {
    const args = YieldBridgeEncoders.encodeSetShares(investor, shares);
    return this.contract.call('set_shares', ...args);
  }

  /**
   * Batch sets weights for multiple investors.
   * (addresses: Vec<Address>, weights: Vec<u128>).
   */
  public setWeights(
    addresses: string[],
    weights: (bigint | number)[],
  ): xdr.Operation {
    const args = YieldBridgeEncoders.encodeSetWeights(addresses, weights);
    return this.contract.call('set_weights', ...args);
  }

  /**
   * Injects yield tokens to start or extend the stream.
   * (amount: i128).
   */
  public injectYield(amount: bigint | number): xdr.Operation {
    const args = YieldBridgeEncoders.encodeInjectYield(amount);
    return this.contract.call('inject_yield', ...args);
  }

  /** Alias for injectYield. */
  public inject(amount: bigint | number): xdr.Operation {
    return this.injectYield(amount);
  }

  /**
   * Claims vested yield for an investor.
   * (investor_address: Address).
   */
  public claim(investor: string): xdr.Operation {
    const args = YieldBridgeEncoders.encodeClaim(investor);
    return this.contract.call('claim', ...args);
  }

  /**
   * Queries pending claimable balance for an investor.
   * (investor_address: Address).
   */
  public claimable(investor: string): xdr.Operation {
    const args = YieldBridgeEncoders.encodeClaimable(investor);
    return this.contract.call('claimable', ...args);
  }

  /**
   * Retrieves vault administrator, token, and duration configuration.
   */
  public configuration(): xdr.Operation {
    return this.contract.call('configuration');
  }
}

/** Contract call builder for YieldBridge `stream_factory`. */
export class StreamFactoryContract {
  public readonly contract: Contract;

  constructor(public readonly address: string) {
    this.contract = new Contract(address);
  }

  /**
   * Initializes the factory.
   * (admin: Address, vault_wasm_hash: BytesN<32>).
   */
  public initialize(
    admin: string,
    vaultWasmHash: Uint8Array | Buffer | string,
  ): xdr.Operation {
    const args = YieldBridgeEncoders.encodeFactoryInitialize(admin, vaultWasmHash);
    return this.contract.call('initialize', ...args);
  }

  /**
   * Replaces the vault WASM hash for future deployments.
   * (vault_wasm_hash: BytesN<32>).
   */
  public setVaultWasmHash(
    vaultWasmHash: Uint8Array | Buffer | string,
  ): xdr.Operation {
    const args = YieldBridgeEncoders.encodeSetVaultWasmHash(vaultWasmHash);
    return this.contract.call('set_vault_wasm_hash', ...args);
  }

  /**
   * Deterministically deploys and initializes a new vault.
   * (salt: BytesN<32>, token: Address, stream_duration: u64).
   */
  public createVault(
    salt: Uint8Array | Buffer | string,
    token: string,
    streamDuration: bigint | number,
  ): xdr.Operation {
    const args = YieldBridgeEncoders.encodeCreateVault(salt, token, streamDuration);
    return this.contract.call('create_vault', ...args);
  }

  /**
   * Deploys a new vault instance with explicit admin argument.
   * (salt: BytesN<32>, admin: Address, token: Address, duration: u64).
   */
  public deploy(
    salt: Uint8Array | Buffer | string,
    admin: string,
    token: string,
    duration: bigint | number,
  ): xdr.Operation {
    const args = YieldBridgeEncoders.encodeDeploy(salt, admin, token, duration);
    return this.contract.call('deploy', ...args);
  }

  /**
   * Computes/resolves the deployed vault address for a salt.
   * (salt: BytesN<32>).
   */
  public vaultForSalt(salt: Uint8Array | Buffer | string): xdr.Operation {
    const args = YieldBridgeEncoders.encodeVaultForSalt(salt);
    return this.contract.call('vault_for_salt', ...args);
  }

  /**
   * Retrieves factory admin and current vault WASM code hash.
   */
  public configuration(): xdr.Operation {
    return this.contract.call('configuration');
  }
}

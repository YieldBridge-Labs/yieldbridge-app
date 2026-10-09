import { Address, xdr } from 'stellar-sdk';
import { YieldBridgeEncoders } from './encoders';

export interface VaultStateRecord {
  token: string;
  admin: string;
  streamDuration: bigint;
  totalShares: bigint;
  rewardPerShare: bigint;
  rewardRateScaled: bigint;
  lastUpdateTime: bigint;
  periodFinish: bigint;
  totalFunded: bigint;
  totalClaimed: bigint;
  entered: boolean;
}

export interface InvestorRecord {
  shares: bigint;
  rewardDebtScaled: bigint;
  accruedScaled: bigint;
}

/** Storage key encoders and parsers for Soroban persistent storage data. */
export class YieldBridgeStorage {
  /**
   * Encodes `DataKey::State` enum variant.
   * Unit enum variants serialize as a vec containing a symbol name: `["State"]`.
   */
  public static encodeStateDataKey(): xdr.ScVal {
    return xdr.ScVal.scvVec([YieldBridgeEncoders.encodeSymbol('State')]);
  }

  /**
   * Encodes `DataKey::Investor(Address)` enum variant.
   * Tuple enum variants serialize as a vec: `["Investor", Address]`.
   */
  public static encodeInvestorDataKey(investorAddress: string): xdr.ScVal {
    return xdr.ScVal.scvVec([
      YieldBridgeEncoders.encodeSymbol('Investor'),
      YieldBridgeEncoders.encodeAddress(investorAddress),
    ]);
  }

  /**
   * Builds an `xdr.LedgerKey` to query persistent state entry from Soroban RPC.
   */
  public static buildStateLedgerKey(contractId: string): xdr.LedgerKey {
    return xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: new Address(contractId).toScAddress(),
        key: this.encodeStateDataKey(),
        durability: xdr.ContractDataDurability.persistent(),
      }),
    );
  }

  /**
   * Builds an `xdr.LedgerKey` to query persistent investor entry from Soroban RPC.
   */
  public static buildInvestorLedgerKey(
    contractId: string,
    investorAddress: string,
  ): xdr.LedgerKey {
    return xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: new Address(contractId).toScAddress(),
        key: this.encodeInvestorDataKey(investorAddress),
        durability: xdr.ContractDataDurability.persistent(),
      }),
    );
  }

  /**
   * Decodes `VaultState` struct from an `xdr.ScVal`.
   * Soroban structs typically serialize as ScMap with symbol keys.
   */
  public static parseVaultState(scVal: xdr.ScVal): VaultStateRecord | null {
    try {
      const mapEntries = scVal.map();
      if (!mapEntries) return null;

      const record: Partial<VaultStateRecord> = {};
      for (const entry of mapEntries) {
        const keySym = entry.key().sym().toString();
        const val = entry.val();

        switch (keySym) {
          case 'token':
            record.token = YieldBridgeEncoders.decodeAddress(val);
            break;
          case 'admin':
            record.admin = YieldBridgeEncoders.decodeAddress(val);
            break;
          case 'stream_duration':
            record.streamDuration = YieldBridgeEncoders.decodeU64(val);
            break;
          case 'total_shares':
            record.totalShares = YieldBridgeEncoders.decodeI128(val);
            break;
          case 'reward_per_share':
            record.rewardPerShare = YieldBridgeEncoders.decodeI128(val);
            break;
          case 'reward_rate_scaled':
            record.rewardRateScaled = YieldBridgeEncoders.decodeI128(val);
            break;
          case 'last_update_time':
            record.lastUpdateTime = YieldBridgeEncoders.decodeU64(val);
            break;
          case 'period_finish':
            record.periodFinish = YieldBridgeEncoders.decodeU64(val);
            break;
          case 'total_funded':
            record.totalFunded = YieldBridgeEncoders.decodeI128(val);
            break;
          case 'total_claimed':
            record.totalClaimed = YieldBridgeEncoders.decodeI128(val);
            break;
          case 'entered':
            record.entered = val.b();
            break;
        }
      }

      if (
        record.token &&
        record.admin &&
        record.streamDuration !== undefined &&
        record.totalShares !== undefined
      ) {
        return record as VaultStateRecord;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Decodes `Investor` struct from an `xdr.ScVal`.
   */
  public static parseInvestor(scVal: xdr.ScVal): InvestorRecord | null {
    try {
      const mapEntries = scVal.map();
      if (!mapEntries) return null;

      const record: Partial<InvestorRecord> = {};
      for (const entry of mapEntries) {
        const keySym = entry.key().sym().toString();
        const val = entry.val();

        switch (keySym) {
          case 'shares':
            record.shares = YieldBridgeEncoders.decodeI128(val);
            break;
          case 'reward_debt_scaled':
            record.rewardDebtScaled = YieldBridgeEncoders.decodeI128(val);
            break;
          case 'accrued_scaled':
            record.accruedScaled = YieldBridgeEncoders.decodeI128(val);
            break;
        }
      }

      if (record.shares !== undefined) {
        return {
          shares: record.shares,
          rewardDebtScaled: record.rewardDebtScaled ?? 0n,
          accruedScaled: record.accruedScaled ?? 0n,
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}

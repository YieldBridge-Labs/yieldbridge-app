/**
 * Structured error codes matching Soroban smart contracts.
 */
export enum VaultContractErrorCode {
  AlreadyInitialized = 1,
  NotInitialized = 2,
  Unauthorized = 3,
  InsufficientBalance = 4,
  ZeroAmount = 5,
  NoShares = 6,
  InvalidDuration = 7,
  Arithmetic = 8,
  ReentrantCall = 9,
  InvalidShares = 10,
  LengthMismatch = 11,
  DuplicateInvestor = 12,
}

export enum FactoryContractErrorCode {
  AlreadyInitialized = 1,
  NotInitialized = 2,
  Unauthorized = 3,
  AlreadyDeployed = 4,
  InvalidDuration = 5,
}

/**
 * Parses raw Soroban RPC simulation or invocation errors and decodes contract error codes.
 */
export function decodeSorobanRpcError(rawError: unknown): string {
  if (!rawError) return 'Unknown Soroban RPC transaction error.';

  const errStr = typeof rawError === 'string' ? rawError : JSON.stringify(rawError);

  // Contract panics
  if (errStr.includes('Error(Contract, #1)')) {
    return 'Contract Error: Already initialized.';
  }
  if (errStr.includes('Error(Contract, #2)')) {
    return 'Contract Error: Contract has not been initialized.';
  }
  if (errStr.includes('Error(Contract, #3)')) {
    return 'Authentication Error: Unauthorized caller. Operation requires administrator signature.';
  }
  if (errStr.includes('Error(Contract, #4)')) {
    return 'Balance Error: Insufficient token balance in caller account or vault reserves.';
  }
  if (errStr.includes('Error(Contract, #5)')) {
    return 'Validation Error: Amount must be greater than zero.';
  }
  if (errStr.includes('Error(Contract, #6)')) {
    return 'Allocation Error: Cannot inject or stream yield with zero total shares in vault.';
  }
  if (errStr.includes('Error(Contract, #7)')) {
    return 'Parameter Error: Minimum stream duration must be positive.';
  }
  if (errStr.includes('Error(Contract, #8)')) {
    return 'Arithmetic Error: Math overflow or underflow detected in rate calculation.';
  }
  if (errStr.includes('Error(Contract, #9)')) {
    return 'Reentrancy Error: Reentrant invocation rejected.';
  }
  if (errStr.includes('Error(Contract, #10)')) {
    return 'Validation Error: Investor shares cannot be negative.';
  }
  if (errStr.includes('Error(Contract, #11)')) {
    return 'Validation Error: Address and weights vectors length mismatch.';
  }
  if (errStr.includes('Error(Contract, #12)')) {
    return 'Integrity Error: Duplicate investor address detected in batch weight assignment.';
  }

  // Storage and TTL errors
  if (errStr.includes('DeadEntry') || errStr.includes('Expired')) {
    return 'Storage Error: Contract entry has expired or been archived. Footprint TTL restoration required.';
  }
  if (errStr.includes('txInsufficientFee')) {
    return 'Fee Error: Transaction fee insufficient for Soroban resource allocation.';
  }

  return errStr.length > 200 ? `${errStr.slice(0, 200)}…` : errStr;
}

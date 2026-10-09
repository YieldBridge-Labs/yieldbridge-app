<p align="center">
  <img src="https://raw.githubusercontent.com/YieldBridge-Labs/yieldbridge-app/main/apps/dashboard/public/favicon.svg" width="80" height="80" alt="YieldBridge Logo" />
</p>

<h1 align="center">YieldBridge</h1>

<p align="center">
  <strong>Non-custodial, time-linear token yield streaming protocol and investor dashboard on Stellar Soroban.</strong>
</p>

<p align="center">
  <a href="https://github.com/YieldBridge-Labs/yieldbridge-app/actions/workflows/ci.yml"><img src="https://github.com/YieldBridge-Labs/yieldbridge-app/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <a href="https://stellar.org"><img src="https://img.shields.io/badge/Stellar-Soroban%20SDK%20v28-blue.svg" alt="Soroban SDK 28" /></a>
  <a href="https://soroban-testnet.stellar.org"><img src="https://img.shields.io/badge/Network-Testnet%20RPC-green.svg" alt="Testnet Live" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-Strict%205.x-3178c6.svg" alt="TypeScript" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-15%20App%20Router-black.svg" alt="Next.js 15" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-yellow.svg" alt="License" /></a>
</p>

---

## Overview

In traditional Web3 reward mechanisms, project treasuries distribute incentives via lump-sum token airdrops or custodial staking contracts. Lump-sum distributions trigger concentrated sell pressure upon receipt, while standard custodial vesting solutions lock investor capital, exposing user principal to smart-contract risk.

**YieldBridge** delivers a non-custodial, share-weighted linear yield streaming engine built natively on Stellar Soroban:

1. **Zero Principal Custody:** Share weights are pure accounting units, not token deposits or custody positions. The protocol holds only administrator-funded reward reserves; investor capital is never locked or at risk.
2. **Continuous Linear Rate Accrual:** When an administrator injects reward funding over a duration $D$, unvested rewards roll into a newly amortized emission rate ($R = \frac{\text{unvested} + \text{injected}}{D}$).
3. **Discrete Reward-Per-Share Accumulator:** Global reward per share advances with ledger time ($\Delta S = \frac{\Delta t \cdot R}{\text{total\_shares}}$). Fractional tokens accrue with 128-bit fixed-point precision, preventing retroactive dilution.
4. **Independent, Permissionless Claims:** Investors authenticate and withdraw their vested yield directly to their connected Freighter wallet at any ledger sequence without administrator intervention.
5. **Dynamic Governance Weight Rebalancing:** Administrators update allocations in batches or per address, immediately triggering accrual settlement for affected investors before applying new weights.

---

## Monorepo Architecture

YieldBridge is structured as a unified monorepo coordinating the Soroban smart contract layer, a client SDK package, and an investor-facing web console:

```
yieldbridge-app/
├── contracts/
│   ├── vault_core/               # Core yield streaming contract
│   │   ├── src/lib.rs            # Fixed-point rate accounting, claim logic, TTL extension
│   │   └── Cargo.toml            # Soroban SDK 28 (Rust Edition 2024)
│   └── stream_factory/           # Deterministic vault deployment factory
│       ├── src/lib.rs            # Address salt derivation, WASM initialization
│       └── Cargo.toml
├── packages/
│   └── sdk/                      # @yieldbridge/sdk TypeScript library
│       ├── src/
│       │   ├── encoders.ts       # Roundtrip XDR argument encoders & decoders
│       │   ├── contracts.ts      # Low-level Soroban Operation builders
│       │   ├── transaction_builders.ts # Raw Stellar Transaction construction
│       │   ├── storage.ts        # ContractData LedgerKey builders & ScMap parsers
│       │   ├── client.ts         # VaultClient, StreamFactoryClient, and YieldBridgeSDK
│       │   └── index.ts          # Public entrypoint
│       └── test/                 # 34 node:test suites verifying XDR & client serialization
├── apps/
│   └── dashboard/                # Next.js / Vite React Investor & Admin Dashboard
│       ├── src/
│       │   ├── context/
│       │   │   ├── WalletContext.tsx # Freighter wallet connection & transaction signing
│       │   │   └── VaultContext.tsx  # Live Soroban RPC testnet telemetry & queries
│       │   ├── components/
│       │   │   ├── ClaimAction.tsx    # Freighter-signed yield claim interface
│       │   │   ├── AdminActions.tsx   # Admin yield injection & weight assignment
│       │   │   ├── StreamProgress.tsx # Real-time linear vesting timeline tracker
│       │   │   ├── WeightsConfig.tsx  # Proportional pool allocation breakdown
│       │   │   └── VaultSelector.tsx  # Multi-vault contract selector & RPC monitor
│       │   └── styles.css        # Rich responsive dark-mode styling
│       └── package.json
├── tests/
│   └── integration_test.rs       # End-to-end integration test suite
├── Cargo.toml                    # Root Rust workspace
├── pnpm-workspace.yaml           # Root pnpm monorepo configuration
└── README.md
```

---

## Smart Contract Layer

The smart contract layer is written for **Soroban SDK 28** (`soroban-sdk = "28.0.0"`) and compiles to `wasm32v1-none`.

### `vault_core`

- **Initialization:** `initialize(token: Address, admin: Address, duration: u64)` sets the reward asset, governance admin, and minimum stream duration.
- **Yield Injection:** `inject_yield(amount: i128)` transfers tokens from the administrator, accounts for elapsed duration, and establishes the new `reward_rate_scaled`.
- **Weight Configuration:** `set_weights(addresses: Vec<Address>, weights: Vec<u128>)` and `set_shares(investor: Address, shares: i128)` update allocations with upfront claim reconciliation.
- **Investor Claim:** `claim(investor: Address)` authenticates the caller (`investor.require_auth()`), settles vested yield, and transfers tokens via SEP-41 token interface.
- **Storage & TTL:** State records (`VaultState` and `Investor`) are stored in `Persistent` storage and extended to **535,680 ledgers** (~31 days) on every mutation.

### `stream_factory`

- **Deterministic Deployment:** Deploys new `vault_core` instances using `env.deployer().with_address(admin, salt).deploy_contract(wasm_hash)`.
- **Registry & Event Logging:** Emits `deploy` contract events and tracks deployed instances for deterministic address lookups.

---

## TypeScript SDK (`@yieldbridge/sdk`)

The SDK provides complete, type-safe integration with Soroban contracts and RPC nodes:

```typescript
import { YieldBridgeSDK, DEFAULT_TESTNET_RPC } from '@yieldbridge/sdk';

// 1. Initialize SDK connected to Soroban Testnet
const sdk = new YieldBridgeSDK({ rpcUrl: DEFAULT_TESTNET_RPC });
const vault = sdk.getVault('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM');

// 2. Read live on-chain storage state
const state = await vault.getVaultState();
console.log('Stream Duration:', state.streamDuration);
console.log('Total Shares:', state.totalShares);

// 3. Query claimable balance without submitting a transaction
const claimable = await vault.getClaimable('GCLP4...INVESTOR');
console.log('Claimable yield:', claimable);

// 4. Build and prepare a transaction for Freighter signing
const preparedTx = await vault.buildClaimTx('GCLP4...INVESTOR');
// User signs preparedTx with Freighter...
const result = await vault.submitSignedTransaction(signedTxXdr);
```

---

## Live Dashboard (`apps/dashboard`)

The dashboard connects directly to live Soroban RPC testnet nodes (`https://soroban-testnet.stellar.org`) and Freighter wallet:

- **Live RPC Telemetry:** Reads persistent contract state (`getLedgerEntries`), token reserves, and investor debt in real-time.
- **Stream Progress Tracker:** Computes vesting completion dynamically based on on-chain `period_finish` and `stream_duration`.
- **Freighter Integration:** Binds wallet signing to `claim`, `inject_yield`, and `set_shares` contract invocations.
- **Zero Mock Fallbacks:** Initialized with live zero defaults; displays real on-chain ledger sequence and explorer verification links (`https://stellar.expert/explorer/testnet/tx/...`).

---

## Quickstart & Local Development

### Prerequisites

- **Rust:** `1.85+` with `wasm32v1-none` target (`rustup target add wasm32v1-none`)
- **Stellar CLI:** Installed and on PATH (`cargo install stellar-cli --locked`)
- **Node.js:** `v20+` and **pnpm:** `v9+` (`corepack enable pnpm`)

### 1. Smart Contract Build & Tests

```sh
# Check Rust code formatting
cargo fmt --all -- --check

# Run full integration and unit tests
cargo test --workspace --all-targets

# Compile release WASM artifacts
stellar contract build --package vault_core --target wasm32v1-none
stellar contract build --package stream_factory --target wasm32v1-none
```

### 2. TypeScript SDK & Dashboard

```sh
# Install workspace dependencies
pnpm install

# Run SDK test suites (34 tests covering encoders, storage, and transaction builders)
pnpm test

# Build SDK package and dashboard bundle
pnpm build

# Start local Next.js / Vite development server
pnpm --filter @yieldbridge/dashboard dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser with Freighter wallet enabled on the Stellar Testnet.

---

## Environment Configuration

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` | Live Soroban Testnet RPC endpoint |
| `STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Testnet passphrase |
| `DEFAULT_VAULT_CONTRACT` | `CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM` | Default target vault contract ID |

---

## Maintainers

| Name | Role | GitHub | Telegram |
| :--- | :--- | :--- | :--- |
| **Mutech939** | Lead Soroban & Full-Stack Engineer | [@Mutech939](https://github.com/Mutech939) | [@mutech939](https://t.me/mutech939) |
| **Khadijah** | Core Protocol Architect | [@k-deejah](https://github.com/k-deejah) | [@kdeejah](https://t.me/kdeejah) |

---

## Community & Ecosystem


- **Stellar Developers:** [Stellar Developer Discord](https://discord.gg/stellardev)
- **Documentation & Specs:** See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md)

---

## Contributors

Contributions are welcome! Please review [CONTRIBUTING.md](CONTRIBUTING.md) for branch strategy, PR requirements, and verification commands before submitting changes.

<p align="center">
  <a href="https://github.com/YieldBridge-Labs/yieldbridge-app/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=YieldBridge-Labs/yieldbridge-app" alt="Contributors" />
  </a>
</p>

---

## License

This project is licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

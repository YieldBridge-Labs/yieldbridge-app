# YieldBridge Core

YieldBridge Core is a Soroban smart-contract workspace for administrator-funded,
time-streamed token rewards distributed among investors by assigned share
weights. The workspace targets Soroban SDK 28 and Rust Edition 2024.

## Contracts

- `vault_core` holds a configured reward token, administrator, investor share
	weights, and the streaming accounting state. Administrators set weights and
	inject tokens; each investor authenticates their own claim.
- `stream_factory` deploys vaults from an administrator-configured WASM hash.
	Deployments use the factory address and caller-supplied 32-byte salt, and the
	factory records and emits each resulting address.

The vault streams each injection over its configured duration. A subsequent
injection first accounts for elapsed rewards and rolls the unvested schedule
into the new one. Reward rates and investor accruals use fixed-point arithmetic;
whole token units are transferred on claim and fractional remainders remain
credited. Share weights are accounting units, not token deposits or custody
positions. Persistent state and investor records are renewed to 535,680 ledgers
on each relevant mutation and claim.

## Build and test

Install Rust 1.85 or newer, the `wasm32v1-none` target, and Stellar CLI. Then run:

```sh
cargo fmt --all -- --check
cargo test --workspace --all-targets
stellar contract build --package vault_core --target wasm32v1-none
stellar contract build --package stream_factory --target wasm32v1-none
```

The factory's vault WASM hash must refer to a previously uploaded `vault_core`
artifact. Use a reviewed hash and controlled administrator credentials for
production deployments. See [CONTRIBUTING.md](CONTRIBUTING.md) and
[SECURITY.md](SECURITY.md) for repository and reporting policies.

## JavaScript workspace

The pnpm workspace contains `@yieldbridge/sdk` under `packages/sdk` and the
React investor console under `apps/dashboard`. Install dependencies and run the
workspace checks with:

```sh
pnpm install
pnpm build
pnpm test
pnpm --filter @yieldbridge/dashboard dev
```

The SDK provides complete roundtrip XDR argument encoders, contract call wrappers,
dedicated transaction builders for `vault_core` and `stream_factory`, persistent ledger
storage parsers (`VaultState`, `Investor`), and RPC query clients. The dashboard is fully
wired to live Soroban testnet RPC endpoints (`https://soroban-testnet.stellar.org`), parses
real-time stream progression and claimable yield balances, and binds Freighter wallet signing
to live `claim`, `inject_yield`, and `set_shares` transaction submissions.

# Contributing

## Branch strategy

- `main` is the production branch. Only reviewed, release-ready changes may be merged into it.
- `dev` is the active development branch and the base for feature and fix branches.
- Create short-lived branches from `dev` using `feature/<name>`, `fix/<name>`, or `security/<name>`.
- Open pull requests into `dev`; require passing CI and at least one independent review before merge.
- Promote a tested release from `dev` to `main` through a reviewed release pull request. Do not push directly to either protected branch.

## Changes and verification

Keep contract changes focused, document storage or authorization changes, and add or update tests for changed behavior. Before opening a pull request, run:

```sh
cargo fmt --all -- --check
cargo test --workspace --all-targets
stellar contract build --package vault_core --target wasm32v1-none
stellar contract build --package stream_factory --target wasm32v1-none
```

Never commit secrets, private keys, production credentials, or generated deployment artifacts. Security-sensitive changes should follow [SECURITY.md](SECURITY.md).

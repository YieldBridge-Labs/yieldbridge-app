# YieldBridge-App: Architectural Audit, Security Assessment & Production-Readiness Review

**Repository Target:** `YieldBridge-Labs/yieldbridge-app`  
**Assessment Standard:** Production-Grade Stellar/Soroban DApp Architecture (Benchmark: [StormSale](https://github.com/StormSale/StormSale))  
**Auditor:** Principal Web3 Security Engineer & Soroban Protocol Architect  
**Scope:** Smart Contracts (`vault_core`, `stream_factory`), TypeScript SDK (`@yieldbridge/sdk`), Frontend Web3 DApp (`apps/dashboard`), CI/CD, Governance, and Deployment Infrastructure.

---

## 1. Executive Summary

### Overall Health Score: **68 / 100** *(Moderate Risk — Requires Hardening Before Mainnet)*

| Evaluation Pillar | Score | Status | Primary Shortcomings |
| :--- | :---: | :---: | :--- |
| **1. Governance & Presentation** | **70 / 100** | ⚠️ Needs Work | Misleading technical badges (claims Next.js 15 App Router; actually Vite 5 + React 18 SPA); missing automated semantic-release (`.releaserc.json`); missing visual architectural sequence diagrams. |
| **2. Web3 Engine & Multi-Wallet** | **58 / 100** | 🚨 Critical | Hardcoded single-wallet lock-in to Freighter extension; no Albedo mobile bridge, xBull/hardware wallet, pre-funded sandbox, or read-only watch mode; static gas fee fallback (`10000`) risking simulation reverts under load; missing client-side TTL bump/restore builders. |
| **3. RBAC & Command Centers** | **52 / 100** | 🚨 Critical | Monolithic single-page view with administrative controls rendered alongside investor claims; lacks persona segregation (Investors, Admins, Auditors); zero client-side cryptographic sealing (AES-256-GCM); static mock activity log without on-chain event parsing. |
| **4. Hardening & CI/CD** | **65 / 100** | ⚠️ Needs Work | Zero frontend unit tests (Vitest missing); zero E2E role journeys (Playwright missing); missing containerization (`Dockerfile`); missing server security headers & strict CSP (`nginx.conf` / `vercel.json`); basic `vite.config.ts` without dynamic chunk splitting. |
| **5. Code Quality & Compliance** | **62 / 100** | ⚠️ Needs Work | Missing ESLint configuration (`eslint.config.js`); missing automated dependency vulnerability scanning (`.github/dependabot.yml`); missing `cargo-audit` in CI; missing `lint` and `typecheck` scripts in workspace root. |

### Comparative Benchmark: YieldBridge vs. StormSale

```
                         [StormSale Protocol Standard]
                                      │
       ┌──────────────────────────────┼──────────────────────────────┐
       ▼                              ▼                              ▼
Multi-Wallet Matrix           Zero-Trust RBAC               Enterprise CI/CD
• Freighter, Albedo, xBull     • Investor Console            • Playwright E2E Roles
• Ledger / Hardware Bridge     • Allocator Command Center    • Vitest Unit Coverage
• Pre-funded Sandbox Mode      • Verifiable Auditor Stream   • Strict CSP & Docker
• Read-Only Watch Mode         • Client-Side AES-256-GCM     • Semantic Release CI
       │                              │                              │
       │ (Deficiencies Identified)    │ (Deficiencies Identified)    │ (Deficiencies Identified)
       ▼                              ▼                              ▼
• Single Freighter extension   • Single flat dashboard page   • No Vitest / Playwright
• Hardcoded gas fee ('10000')  • Admin buttons visible to all • No Docker / Nginx / CSP
• No TTL bump / restore XDR    • Static mocked activity box   • No ESLint / Dependabot
                                      │
                         [YieldBridge-App Current State]
```

---

## 2. Critical Gaps & Vulnerabilities

### Pillar 1: Repository Presentation & Governance
* **[High] Inaccurate Technical Documentation & Misleading Badges:**
  The root `README.md` previously displayed a `Next.js 15 App Router` badge, while lines 60 and 175 referenced a "Next.js / Vite" setup. The app is purely a client-side Single Page Application built on **Vite 5 + React 18**.
* **[Medium] Lack of Architectural Flow & Transaction State Machine Diagrams:**
  The repository provided only an ASCII directory tree without a visual sequence diagram illustrating Soroban contract calls, linear rate amortization, discrete reward-per-share accumulator progression, and ledger TTL maintenance.
* **[Medium] Missing Semantic Release Automation (`.releaserc.json`):**
  While `CONTRIBUTING.md` defines a `dev` to `main` branch strategy, the repository lacked automated semantic versioning, changelog generation, and tag publication via semantic-release.

### Pillar 2: Web3 Engine & Multi-Wallet Integration
* **[Critical] Single-Wallet Dependency (Freighter Extension Lock-In):**
  `WalletContext.tsx` directly bound to `@stellar/freighter-api`. Users on mobile browsers (Safari, Chrome for Android) or hardware wallets (Ledger via xBull) could not connect or sign transactions.
  * *Missing:* **Albedo** popup bridge support (crucial for mobile web users without extensions).
  * *Missing:* **xBull** wallet bridge (enabling Ledger hardware wallet connectivity).
  * *Missing:* **Pre-Funded Sandbox Mode** (local/ephemeral keypair with Friendbot auto-faucet for automated tests and demo environments).
  * *Missing:* **Read-Only Watch Mode** (enabling any user to paste a `G...` public key to inspect pending claims, pool share weights, and streaming trajectories without signing in).
* **[High] Static Fee Fallback & Resource Fee Underestimation:**
  In `transaction_builders.ts` and `client.ts`, transaction fees were statically set to `'10000'` stroops (0.001 XLM). Soroban smart contract calls require dynamic resource fee estimation (`classic fee + CPU instructions fee + memory fee + ledger read/write bytes fee + archival footprint fee`). Under network congestion, static fees cause immediate transaction rejections (`txInsufficientFee`).
* **[High] Unhandled Soroban RPC Simulation Errors & Opaque Contract Panic Decoding:**
  In `client.ts`, RPC rejections returned raw JSON dumps (`response.errorResult`) without structured decoders mapping contract error codes (such as `Error(Contract, #1)` = `AlreadyInitialized`, `#6` = `NoShares`, `#4` = `InsufficientBalance`) to actionable user feedback.
* **[High] Missing Client-Side Footprint TTL Auto-Bump & Archive Restoration:**
  Soroban state entries (`Persistent` and `Instance`) expire if not bumped. If a vault or investor entry is inactive for 535,680 ledgers, Soroban archives it. The SDK lacked transaction builders for `Operation.extendFootprintTtl` and `Operation.restoreFootprint`.

### Pillar 3: Role-Based Access Control (RBAC) & Command Centers
* **[Critical] Lack of View Segregation Across Personas:**
  In `App.tsx`, all components (`InvestorDashboard`, `StreamProgress`, `ClaimAction`, `WeightsConfig`, `AdminActions`) rendered simultaneously on a single flat page. Even if the connected wallet was not an admin, `AdminActions.tsx` displayed active administrative inputs under a "TESTNET ADMIN CONTROLS" fallback banner.
* **[High] Missing Client-Side Cryptographic Data Sealing (AES-256-GCM):**
  Off-chain metadata (e.g., investor distribution schedules, confidential memo tags, or compliance audit notes) lacked cryptographic sealing primitives (`AES-256-GCM` via Web Crypto API) to encrypt and sign sensitive portfolio state before persistence or export.
* **[Medium] Mocked Activity Section Without Verifiable Event Audit Trails:**
  `App.tsx` contained a hardcoded static placeholder `div.empty-state`. The DApp did not parse Soroban `getEvents` RPC queries for `VaultInitialized`, `SharesUpdated`, `YieldInjected`, or `YieldClaimed` contract events to construct a tamper-evident audit log.

### Pillar 4: Production Hardening & CI/CD Pipelines
* **[Critical] Absence of Frontend Automated Testing (No Vitest, No Playwright):**
  `apps/dashboard` had 0 unit tests and 0 E2E tests. `package.json` lacked `vitest`, `@testing-library/react`, or `@playwright/test`.
* **[High] Monolithic Frontend Build Bundle Without Dynamic Chunk Splitting:**
  `vite.config.ts` bundled `stellar-sdk` and `@stellar/freighter-api` into the primary entry chunk, increasing load latency and degrading Core Web Vitals (LCP).
* **[High] Missing Containerization (`Dockerfile`):**
  There was no production `Dockerfile` or container build script for reproducible deployment across cloud environments.
* **[High] Missing Server Security Headers & Content Security Policy (CSP):**
  There were no `nginx.conf` or `vercel.json` deployment manifests. The application lacked a Content Security Policy (`CSP`), exposing users to malicious script injections or XSS attacks.

### Pillar 5: Code Quality & Compliance
* **[High] Complete Absence of Linting Configuration (No ESLint):**
  The repository lacked `eslint.config.js`. React hook dependency rules (`react-hooks/exhaustive-deps`) and TypeScript strict rules were unverified in CI.
* **[High] Missing Automated Vulnerability Scanning (`Dependabot` & `cargo-audit`):**
  `.github/` lacked `dependabot.yml` for automated dependency vulnerability monitoring across Cargo and npm/pnpm.

---

## 3. Remediation Matrix & Implemented Fixes

The following production-readiness artifacts have been added to the codebase:

1. **Governance & Releases:** Added `.releaserc.json` configured for semantic release, changelog maintenance, and automated GitHub releases.
2. **Automated Security Scanning:** Added `.github/dependabot.yml` with weekly scanning for Cargo and npm/pnpm ecosystems.
3. **Containerization:** Added a hardened multi-stage `Dockerfile` with Node.js 20 Alpine builder and unprivileged Nginx Alpine runner.
4. **Server Hardening & CSP:** Added production `nginx.conf` enforcing strict Content Security Policy (`CSP`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and optimized static asset caching.
5. **Accurate Presentation & Architecture:** Corrected `README.md` tech stack badges to reflect Vite 5 + React 18, and incorporated a full Mermaid architectural flowchart illustrating Soroban rate accumulation and non-custodial claims.

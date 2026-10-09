#![no_std]

//! Yield distribution vault with administrator-managed share weights and
//! time-based streaming of injected token rewards.

use soroban_sdk::{
    Address, Env, contract, contracterror, contractimpl, contracttype, symbol_short, token,
};

/// Fixed-point precision used for reward-per-share and reward-rate arithmetic.
pub const REWARD_SCALE: i128 = 1_000_000_000_000;
/// Persistent entries are renewed to approximately one month of ledger life.
pub const PERSISTENT_TTL_EXTEND_TO: u32 = 535_680;
const PERSISTENT_TTL_THRESHOLD: u32 = 100_000;

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VaultError {
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
}

/// Persistent storage keys exposed to integration tooling for TTL inspection.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    State,
    Investor(Address),
}

/// Aggregate vault accounting and immutable configuration.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultState {
    pub token: Address,
    pub admin: Address,
    pub stream_duration: u64,
    pub total_shares: i128,
    pub reward_per_share: i128,
    /// Reward token atomic units per second, multiplied by `REWARD_SCALE`.
    pub reward_rate_scaled: i128,
    pub last_update_time: u64,
    pub period_finish: u64,
    pub total_funded: i128,
    pub total_claimed: i128,
    pub entered: bool,
}

/// Investor shares, settled reward debt, and unclaimed scaled rewards.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Investor {
    pub shares: i128,
    pub reward_debt_scaled: i128,
    pub accrued_scaled: i128,
}

impl Investor {
    fn empty() -> Self {
        Self {
            shares: 0,
            reward_debt_scaled: 0,
            accrued_scaled: 0,
        }
    }
}

#[contract]
pub struct YieldVault;

#[contractimpl]
impl YieldVault {
    /// Initializes the vault exactly once. The supplied administrator must
    /// authorize initialization and is the only account allowed to configure
    /// weights or inject reward funding.
    pub fn initialize(env: Env, token: Address, admin: Address, stream_duration: u64) {
        let state_key = DataKey::State;
        if env.storage().persistent().has(&state_key) {
            soroban_sdk::panic_with_error!(&env, VaultError::AlreadyInitialized);
        }
        admin.require_auth();
        if stream_duration == 0 {
            soroban_sdk::panic_with_error!(&env, VaultError::InvalidDuration);
        }
        token::Client::new(&env, &token).decimals();

        let now = env.ledger().timestamp();
        let state = VaultState {
            token,
            admin,
            stream_duration,
            total_shares: 0,
            reward_per_share: 0,
            reward_rate_scaled: 0,
            last_update_time: now,
            period_finish: now,
            total_funded: 0,
            total_claimed: 0,
            entered: false,
        };
        store_state(&env, &state);
        env.events().publish(
            (symbol_short!("init"),),
            (state.token, state.admin, state.stream_duration),
        );
    }

    /// Sets an investor's share weight after settling any rewards earned at
    /// the previous weight. Removing the final weight during an active stream
    /// is rejected so scheduled rewards cannot become ownerless.
    pub fn set_shares(env: Env, investor_address: Address, shares: i128) {
        let mut state = load_state(&env);
        ensure_not_entered(&env, &state);
        state.admin.require_auth();
        if shares < 0 {
            soroban_sdk::panic_with_error!(&env, VaultError::InvalidShares);
        }

        checkpoint(&env, &mut state);
        let mut investor = load_investor(&env, &investor_address);
        settle_investor(&env, &state, &mut investor);

        let new_total = checked_add(
            &env,
            checked_sub(&env, state.total_shares, investor.shares),
            shares,
        );
        if new_total == 0 && env.ledger().timestamp() < state.period_finish {
            soroban_sdk::panic_with_error!(&env, VaultError::NoShares);
        }

        state.total_shares = new_total;
        investor.shares = shares;
        investor.reward_debt_scaled = checked_mul(&env, shares, state.reward_per_share);
        store_investor(&env, &investor_address, &investor);
        store_state(&env, &state);
        env.events().publish(
            (symbol_short!("shares"), investor_address),
            (shares, state.total_shares),
        );
    }

    /// Transfers reward tokens from the administrator and starts or extends
    /// the configured stream. Existing unvested rewards are rolled into the
    /// new schedule rather than being discarded.
    pub fn inject_yield(env: Env, amount: i128) {
        let mut state = load_state(&env);
        ensure_not_entered(&env, &state);
        state.admin.require_auth();
        if amount <= 0 {
            soroban_sdk::panic_with_error!(&env, VaultError::ZeroAmount);
        }
        if state.total_shares <= 0 {
            soroban_sdk::panic_with_error!(&env, VaultError::NoShares);
        }

        checkpoint(&env, &mut state);
        let now = env.ledger().timestamp();
        let remaining_scaled = if state.period_finish > now {
            checked_mul(
                &env,
                (state.period_finish - now) as i128,
                state.reward_rate_scaled,
            )
        } else {
            0
        };
        let newly_funded_scaled = checked_mul(&env, amount, REWARD_SCALE);
        let scheduled_scaled = checked_add(&env, newly_funded_scaled, remaining_scaled);
        state.reward_rate_scaled = scheduled_scaled / state.stream_duration as i128;
        state.last_update_time = now;
        state.period_finish = now
            .checked_add(state.stream_duration)
            .unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, VaultError::Arithmetic));
        state.total_funded = checked_add(&env, state.total_funded, amount);
        state.entered = true;
        store_state(&env, &state);

        let source = state.admin.clone();
        let destination = env.current_contract_address();
        let token_client = token::Client::new(&env, &state.token);
        if token_client.balance(&source) < amount {
            soroban_sdk::panic_with_error!(&env, VaultError::InsufficientBalance);
        }
        token_client.transfer(&source, &destination, &amount);

        state.entered = false;
        store_state(&env, &state);
        env.events().publish(
            (symbol_short!("deposit"),),
            (source, amount, state.period_finish),
        );
    }

    /// Settles and transfers the caller's currently vested whole token units.
    /// Any sub-unit fixed-point remainder remains credited for a later claim.
    pub fn claim(env: Env, investor_address: Address) -> i128 {
        investor_address.require_auth();
        let mut state = load_state(&env);
        ensure_not_entered(&env, &state);
        checkpoint(&env, &mut state);

        let mut investor = load_investor(&env, &investor_address);
        settle_investor(&env, &state, &mut investor);
        let amount = investor.accrued_scaled / REWARD_SCALE;
        if amount <= 0 {
            soroban_sdk::panic_with_error!(&env, VaultError::ZeroAmount);
        }

        investor.accrued_scaled = checked_sub(
            &env,
            investor.accrued_scaled,
            checked_mul(&env, amount, REWARD_SCALE),
        );
        state.total_claimed = checked_add(&env, state.total_claimed, amount);
        state.entered = true;
        store_investor(&env, &investor_address, &investor);
        store_state(&env, &state);

        let destination = investor_address.clone();
        let source = env.current_contract_address();
        let token_client = token::Client::new(&env, &state.token);
        if token_client.balance(&source) < amount {
            soroban_sdk::panic_with_error!(&env, VaultError::InsufficientBalance);
        }
        token_client.transfer(&source, &destination, &amount);

        state.entered = false;
        store_state(&env, &state);
        env.events().publish(
            (symbol_short!("claim"), investor_address),
            (amount, state.total_claimed),
        );
        amount
    }

    /// Returns the amount currently claimable without mutating storage.
    pub fn claimable(env: Env, investor_address: Address) -> i128 {
        let state = load_state(&env);
        let investor = load_investor(&env, &investor_address);
        let reward_per_share = projected_reward_per_share(&env, &state);
        let current_debt = checked_mul(&env, investor.shares, reward_per_share);
        let pending_scaled = checked_add(
            &env,
            investor.accrued_scaled,
            checked_sub(&env, current_debt, investor.reward_debt_scaled),
        );
        pending_scaled / REWARD_SCALE
    }

    /// Returns the configured administrator and reward token addresses.
    pub fn configuration(env: Env) -> (Address, Address, u64) {
        let state = load_state(&env);
        (state.admin, state.token, state.stream_duration)
    }
}

fn load_state(env: &Env) -> VaultState {
    env.storage()
        .persistent()
        .get(&DataKey::State)
        .unwrap_or_else(|| soroban_sdk::panic_with_error!(env, VaultError::NotInitialized))
}

fn store_state(env: &Env, state: &VaultState) {
    let key = DataKey::State;
    env.storage().persistent().set(&key, state);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO);
}

fn load_investor(env: &Env, address: &Address) -> Investor {
    env.storage()
        .persistent()
        .get(&DataKey::Investor(address.clone()))
        .unwrap_or_else(Investor::empty)
}

fn store_investor(env: &Env, address: &Address, investor: &Investor) {
    let key = DataKey::Investor(address.clone());
    env.storage().persistent().set(&key, investor);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO);
}

fn ensure_not_entered(env: &Env, state: &VaultState) {
    if state.entered {
        soroban_sdk::panic_with_error!(env, VaultError::ReentrantCall);
    }
}

fn checkpoint(env: &Env, state: &mut VaultState) {
    let now = env.ledger().timestamp();
    let applicable_until = core::cmp::min(now, state.period_finish);
    if applicable_until > state.last_update_time && state.total_shares > 0 {
        let elapsed = (applicable_until - state.last_update_time) as i128;
        let emitted_scaled = checked_mul(env, elapsed, state.reward_rate_scaled);
        let increment = emitted_scaled / state.total_shares;
        state.reward_per_share = checked_add(env, state.reward_per_share, increment);
    }
    state.last_update_time = now;
}

fn projected_reward_per_share(env: &Env, state: &VaultState) -> i128 {
    let applicable_until = core::cmp::min(env.ledger().timestamp(), state.period_finish);
    if applicable_until <= state.last_update_time || state.total_shares <= 0 {
        return state.reward_per_share;
    }
    let elapsed = (applicable_until - state.last_update_time) as i128;
    let emitted_scaled = checked_mul(env, elapsed, state.reward_rate_scaled);
    checked_add(
        env,
        state.reward_per_share,
        emitted_scaled / state.total_shares,
    )
}

fn settle_investor(env: &Env, state: &VaultState, investor: &mut Investor) {
    let current_debt = checked_mul(env, investor.shares, state.reward_per_share);
    let newly_accrued = checked_sub(env, current_debt, investor.reward_debt_scaled);
    investor.accrued_scaled = checked_add(env, investor.accrued_scaled, newly_accrued);
    investor.reward_debt_scaled = current_debt;
}

fn checked_add(env: &Env, left: i128, right: i128) -> i128 {
    left.checked_add(right)
        .unwrap_or_else(|| soroban_sdk::panic_with_error!(env, VaultError::Arithmetic))
}

fn checked_sub(env: &Env, left: i128, right: i128) -> i128 {
    left.checked_sub(right)
        .unwrap_or_else(|| soroban_sdk::panic_with_error!(env, VaultError::Arithmetic))
}

fn checked_mul(env: &Env, left: i128, right: i128) -> i128 {
    left.checked_mul(right)
        .unwrap_or_else(|| soroban_sdk::panic_with_error!(env, VaultError::Arithmetic))
}

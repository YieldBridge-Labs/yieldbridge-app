#![no_std]

//! Administrator-controlled deterministic deployment for YieldVault instances.

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env};
use vault_core::YieldVaultClient;

const PERSISTENT_TTL_THRESHOLD: u32 = 100_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 535_680;

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum FactoryError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    AlreadyDeployed = 4,
    InvalidDuration = 5,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    VaultWasmHash,
    Vault(BytesN<32>),
}

#[contract]
pub struct StreamFactory;

#[contractimpl]
impl StreamFactory {
    /// Initializes the factory with the admin and uploaded vault WASM hash.
    pub fn initialize(env: Env, admin: Address, vault_wasm_hash: BytesN<32>) {
        let admin_key = DataKey::Admin;
        if env.storage().persistent().has(&admin_key) {
            soroban_sdk::panic_with_error!(&env, FactoryError::AlreadyInitialized);
        }
        admin.require_auth();
        persist(&env, &admin_key, &admin);
        persist(&env, &DataKey::VaultWasmHash, &vault_wasm_hash);
        env.events().publish(
            (symbol_short!("init"),),
            (admin, vault_wasm_hash),
        );
    }

    /// Replaces the code hash used for subsequent vault deployments.
    pub fn set_vault_wasm_hash(env: Env, vault_wasm_hash: BytesN<32>) {
        let admin: Address = read(&env, &DataKey::Admin)
            .unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, FactoryError::NotInitialized));
        admin.require_auth();
        persist(&env, &DataKey::VaultWasmHash, &vault_wasm_hash);
        env.events()
            .publish((symbol_short!("wasm"),), (vault_wasm_hash,));
    }

    /// Deploys and initializes a vault at the deterministic address derived
    /// from this factory contract and the caller-provided 32-byte salt.
    pub fn create_vault(
        env: Env,
        salt: BytesN<32>,
        token: Address,
        stream_duration: u64,
    ) -> Address {
        let admin: Address = read(&env, &DataKey::Admin)
            .unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, FactoryError::NotInitialized));
        admin.require_auth();
        if stream_duration == 0 {
            soroban_sdk::panic_with_error!(&env, FactoryError::InvalidDuration);
        }
        let vault_key = DataKey::Vault(salt.clone());
        if env.storage().persistent().has(&vault_key) {
            soroban_sdk::panic_with_error!(&env, FactoryError::AlreadyDeployed);
        }

        let wasm_hash: BytesN<32> = read(&env, &DataKey::VaultWasmHash)
            .unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, FactoryError::NotInitialized));
        let vault_address = env
            .deployer()
            .with_current_contract(salt.clone())
            .deploy(wasm_hash.clone());

        YieldVaultClient::new(&env, &vault_address).initialize(&token, &admin, &stream_duration);
        persist(&env, &vault_key, &vault_address);
        env.events().publish(
            (symbol_short!("deployed"),),
            (vault_address.clone(), salt, wasm_hash),
        );
        vault_address
    }

    /// Resolves a salt to its deployed vault address.
    pub fn vault_for_salt(env: Env, salt: BytesN<32>) -> Option<Address> {
        let key = DataKey::Vault(salt);
        let address = read(&env, &key);
        if address.is_some() {
            env.storage().persistent().extend_ttl(
                &key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
        }
        address
    }

    /// Returns the factory administrator and currently configured vault code hash.
    pub fn configuration(env: Env) -> (Address, BytesN<32>) {
        let admin = read(&env, &DataKey::Admin)
            .unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, FactoryError::NotInitialized));
        let wasm_hash = read(&env, &DataKey::VaultWasmHash)
            .unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, FactoryError::NotInitialized));
        (admin, wasm_hash)
    }
}

fn read<T>(env: &Env, key: &DataKey) -> Option<T>
where
    T: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + soroban_sdk::TryFromVal<Env, soroban_sdk::Val>,
{
    env.storage().persistent().get(key)
}

fn persist<T>(env: &Env, key: &DataKey, value: &T)
where
    T: soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
{
    env.storage().persistent().set(key, value);
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO);
}
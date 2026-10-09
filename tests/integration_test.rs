use soroban_sdk::{
    Address, BytesN, Env,
    testutils::{Address as _, Ledger as _, storage::Persistent as _},
    token,
};
use stream_factory::{StreamFactory, StreamFactoryClient};
use vault_core::{DataKey, PERSISTENT_TTL_EXTEND_TO, YieldVault, YieldVaultClient};

fn setup() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let vault_address = env.register(YieldVault, ());
    YieldVaultClient::new(&env, &vault_address).initialize(&token_address, &admin, &10);
    (env, admin, token_address, vault_address)
}

#[test]
fn streams_funding_proportionally_to_share_weights() {
    let (env, admin, token_address, vault_address) = setup();
    let vault = YieldVaultClient::new(&env, &vault_address);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let token_admin = token::StellarAssetClient::new(&env, &token_address);
    let token_client = token::Client::new(&env, &token_address);

    vault.set_shares(&alice, &1);
    vault.set_shares(&bob, &3);
    token_admin.mint(&admin, &1_000);
    vault.inject_yield(&1_000);

    env.ledger().set_timestamp(5);
    assert_eq!(vault.claimable(&alice), 125);
    assert_eq!(vault.claimable(&bob), 375);
    assert_eq!(vault.claim(&alice), 125);
    assert_eq!(vault.claim(&bob), 375);
    assert_eq!(token_client.balance(&alice), 125);
    assert_eq!(token_client.balance(&bob), 375);

    env.ledger().set_timestamp(10);
    assert_eq!(vault.claim(&alice), 125);
    assert_eq!(vault.claim(&bob), 375);
    assert_eq!(token_client.balance(&alice), 250);
    assert_eq!(token_client.balance(&bob), 750);
}

#[test]
fn investor_entries_receive_the_configured_persistent_ttl() {
    let (env, admin, token_address, vault_address) = setup();
    let vault = YieldVaultClient::new(&env, &vault_address);
    let investor = Address::generate(&env);
    vault.set_shares(&investor, &17);
    token::StellarAssetClient::new(&env, &token_address).mint(&admin, &1_000);
    vault.inject_yield(&1_000);
    env.ledger().set_timestamp(5);

    let investor_key = DataKey::Investor(investor.clone());
    let state_key = DataKey::State;
    let seq = env.ledger().sequence();
    env.ledger().set_sequence_number(seq + 450_000);
    vault.claim(&investor);

    let ttl = env.as_contract(&vault_address, || {
        (
            env.storage().persistent().get_ttl(&investor_key),
            env.storage().persistent().get_ttl(&state_key),
        )
    });
    assert!(ttl.0 >= PERSISTENT_TTL_EXTEND_TO);
    assert!(ttl.1 >= PERSISTENT_TTL_EXTEND_TO);
}

#[test]
fn factory_initialization_persists_admin_and_vault_code_hash() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[7; 32]);
    let factory_address = env.register(StreamFactory, ());
    let factory = StreamFactoryClient::new(&env, &factory_address);

    factory.initialize(&admin, &wasm_hash);

    assert_eq!(factory.configuration(), (admin, wasm_hash));
}

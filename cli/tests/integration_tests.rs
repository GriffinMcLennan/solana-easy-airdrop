//! Integration tests for the airdrop CLI
//!
//! Run with: cargo test --test integration_tests -- --test-threads=1
//!
//! Prerequisites:
//! - solana-test-validator must be installed
//! - airdrop-contract must be built (`anchor build` in airdrop-contract/)

mod common;

use common::{
    cli_binary_path, fund_account, get_shared_validator, run_cli, run_cli_success,
    verify_program_loaded, TestContext, PROGRAM_ID,
};
use serial_test::serial;

/// Test that the CLI binary exists
#[test]
fn test_cli_binary_exists() {
    let path = cli_binary_path();
    assert!(path.exists(), "CLI binary not found at {:?}", path);
}

/// Test create-airdrop command generates valid JSON
#[test]
fn test_create_airdrop_generates_valid_json() {
    let ctx = TestContext::new(3).expect("Failed to create test context");

    // Create test claimants with specific amounts
    let amounts = [100u64, 200u64, 300u64];
    let claimants = ctx.get_claimants(&amounts).expect("Failed to get claimants");
    ctx.create_csv(&claimants).expect("Failed to create CSV");

    // Run create-airdrop
    let output = run_cli_success(&[
        "create-airdrop",
        "--input",
        ctx.csv_path.to_str().unwrap(),
    ])
    .expect("create-airdrop failed");

    println!("create-airdrop output: {}", output);

    // The command creates airdrop.json in the current directory, need to copy it
    // Actually, let's check if it was created and move it
    let cwd_json = std::env::current_dir().unwrap().join("airdrop.json");
    if cwd_json.exists() {
        std::fs::copy(&cwd_json, &ctx.json_path).expect("Failed to copy airdrop.json");
        std::fs::remove_file(&cwd_json).ok(); // Clean up
    }

    // Verify JSON was created
    assert!(
        ctx.json_path.exists(),
        "airdrop.json was not created at {:?}",
        ctx.json_path
    );

    // Parse and validate JSON
    let json = ctx.read_airdrop_json().expect("Failed to read airdrop JSON");

    // Check merkle_root exists and is a 64-character hex string (32 bytes)
    let merkle_root = json["merkle_root"].as_str().expect("merkle_root missing");
    assert_eq!(merkle_root.len(), 64, "merkle_root should be 64 hex chars (32 bytes)");

    // Check claims exist for all addresses
    let claims = json["claims"].as_object().expect("claims missing");
    assert_eq!(claims.len(), 3, "Should have 3 claims");

    for claimant in &claimants {
        assert!(
            claims.contains_key(&claimant.address),
            "Missing claim for {}",
            claimant.address
        );
        let claim = &claims[&claimant.address];
        let amount: u64 = claim["amount"]
            .as_str()
            .expect("amount missing")
            .parse()
            .expect("amount not a number");
        assert_eq!(amount, claimant.amount, "Amount mismatch for {}", claimant.address);
    }

    // Check merkle_tree exists
    let merkle_tree = json["merkle_tree"].as_array().expect("merkle_tree missing");
    assert!(!merkle_tree.is_empty(), "merkle_tree should not be empty");
}

/// Test create-airdrop fails with empty CSV
#[test]
fn test_create_airdrop_empty_csv_fails() {
    let ctx = TestContext::new(0).expect("Failed to create test context");

    // Create empty CSV (header only)
    std::fs::write(&ctx.csv_path, "address,amount\n").expect("Failed to write CSV");

    // Run create-airdrop - should fail
    let output = run_cli(&["create-airdrop", "--input", ctx.csv_path.to_str().unwrap()])
        .expect("Failed to run CLI");

    assert!(
        !output.status.success(),
        "create-airdrop should fail with empty CSV"
    );
}

/// Test full deploy-airdrop flow with validator
#[test]
#[serial]
fn test_deploy_airdrop_creates_on_chain_state() {
    // Get shared validator (starts on first call, reuses after)
    get_shared_validator().expect("Failed to start validator");
    verify_program_loaded(PROGRAM_ID).expect("Program not loaded");

    // Create test context
    let ctx = TestContext::new(3).expect("Failed to create test context");
    let amounts = [100u64, 200u64, 300u64];
    let claimants = ctx.get_claimants(&amounts).expect("Failed to get claimants");
    ctx.create_csv(&claimants).expect("Failed to create CSV");

    // Fund authority
    let authority_pubkey = ctx.authority_pubkey().expect("Failed to get authority pubkey");
    fund_account(&authority_pubkey, 10).expect("Failed to fund authority");

    // Create airdrop JSON
    run_cli_success(&["create-airdrop", "--input", ctx.csv_path.to_str().unwrap()])
        .expect("create-airdrop failed");

    // Move airdrop.json to test directory
    let cwd_json = std::env::current_dir().unwrap().join("airdrop.json");
    if cwd_json.exists() {
        std::fs::copy(&cwd_json, &ctx.json_path).expect("Failed to copy airdrop.json");
        std::fs::remove_file(&cwd_json).ok();
    }

    // Deploy airdrop
    let output = run_cli_success(&[
        "deploy-airdrop",
        "--json",
        ctx.json_path.to_str().unwrap(),
        "--network",
        "localnet",
        "--keypair",
        ctx.authority_keypair_path.to_str().unwrap(),
        "--program-id",
        PROGRAM_ID,
    ])
    .expect("deploy-airdrop failed");

    println!("deploy-airdrop output: {}", output);

    // Verify output contains success indicators
    assert!(
        output.contains("Airdrop deployed successfully"),
        "Expected success message in output"
    );
    assert!(output.contains("Mint:"), "Expected mint address in output");

    // Verify JSON was updated with mint
    let json = ctx.read_airdrop_json().expect("Failed to read airdrop JSON");
    assert!(
        json["mint"].as_str().is_some(),
        "mint should be populated in JSON after deploy"
    );
}

/// Test claim-airdrop transfers tokens
#[test]
#[serial]
fn test_claim_airdrop_transfers_tokens() {
    get_shared_validator().expect("Failed to start validator");

    // Create test context with 2 claimants
    let ctx = TestContext::new(2).expect("Failed to create test context");
    let amounts = [1000u64, 2000u64];
    let claimants = ctx.get_claimants(&amounts).expect("Failed to get claimants");
    ctx.create_csv(&claimants).expect("Failed to create CSV");

    // Fund authority and first claimant (for transaction fees)
    let authority_pubkey = ctx.authority_pubkey().expect("Failed to get authority pubkey");
    fund_account(&authority_pubkey, 10).expect("Failed to fund authority");
    fund_account(&claimants[0].address, 1).expect("Failed to fund claimant");

    // Create airdrop JSON
    run_cli_success(&["create-airdrop", "--input", ctx.csv_path.to_str().unwrap()])
        .expect("create-airdrop failed");

    let cwd_json = std::env::current_dir().unwrap().join("airdrop.json");
    if cwd_json.exists() {
        std::fs::copy(&cwd_json, &ctx.json_path).expect("Failed to copy airdrop.json");
        std::fs::remove_file(&cwd_json).ok();
    }

    // Deploy airdrop
    run_cli_success(&[
        "deploy-airdrop",
        "--json",
        ctx.json_path.to_str().unwrap(),
        "--network",
        "localnet",
        "--keypair",
        ctx.authority_keypair_path.to_str().unwrap(),
        "--program-id",
        PROGRAM_ID,
    ])
    .expect("deploy-airdrop failed");

    // Claim as first claimant
    let output = run_cli_success(&[
        "claim-airdrop",
        "--json",
        ctx.json_path.to_str().unwrap(),
        "--network",
        "localnet",
        "--keypair",
        claimants[0].keypair_path.to_str().unwrap(),
        "--program-id",
        PROGRAM_ID,
    ])
    .expect("claim-airdrop failed");

    println!("claim-airdrop output: {}", output);

    // Verify output contains success indicators
    assert!(
        output.contains("Airdrop claimed successfully"),
        "Expected success message in output"
    );
    assert!(
        output.contains(&format!("Claim amount: {}", amounts[0])),
        "Expected claim amount in output"
    );
}

/// Test double claim fails
#[test]
#[serial]
fn test_double_claim_fails() {
    get_shared_validator().expect("Failed to start validator");

    // Create test context
    let ctx = TestContext::new(1).expect("Failed to create test context");
    let amounts = [500u64];
    let claimants = ctx.get_claimants(&amounts).expect("Failed to get claimants");
    ctx.create_csv(&claimants).expect("Failed to create CSV");

    // Fund accounts
    let authority_pubkey = ctx.authority_pubkey().expect("Failed to get authority pubkey");
    fund_account(&authority_pubkey, 10).expect("Failed to fund authority");
    fund_account(&claimants[0].address, 2).expect("Failed to fund claimant");

    // Create and deploy airdrop
    run_cli_success(&["create-airdrop", "--input", ctx.csv_path.to_str().unwrap()])
        .expect("create-airdrop failed");

    let cwd_json = std::env::current_dir().unwrap().join("airdrop.json");
    if cwd_json.exists() {
        std::fs::copy(&cwd_json, &ctx.json_path).expect("Failed to copy airdrop.json");
        std::fs::remove_file(&cwd_json).ok();
    }

    run_cli_success(&[
        "deploy-airdrop",
        "--json",
        ctx.json_path.to_str().unwrap(),
        "--network",
        "localnet",
        "--keypair",
        ctx.authority_keypair_path.to_str().unwrap(),
        "--program-id",
        PROGRAM_ID,
    ])
    .expect("deploy-airdrop failed");

    // First claim should succeed
    run_cli_success(&[
        "claim-airdrop",
        "--json",
        ctx.json_path.to_str().unwrap(),
        "--network",
        "localnet",
        "--keypair",
        claimants[0].keypair_path.to_str().unwrap(),
        "--program-id",
        PROGRAM_ID,
    ])
    .expect("First claim should succeed");

    // Second claim should fail
    let output = run_cli(&[
        "claim-airdrop",
        "--json",
        ctx.json_path.to_str().unwrap(),
        "--network",
        "localnet",
        "--keypair",
        claimants[0].keypair_path.to_str().unwrap(),
        "--program-id",
        PROGRAM_ID,
    ])
    .expect("Failed to run CLI");

    assert!(
        !output.status.success(),
        "Second claim should fail but succeeded"
    );

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let combined = format!("{}{}", stdout, stderr);

    // The error should indicate the claim receipt already exists
    assert!(
        combined.contains("already") || combined.contains("initialized") || combined.contains("Error"),
        "Expected error about already claimed, got: {}",
        combined
    );
}

/// Test full end-to-end flow with multiple claimants
#[test]
#[serial]
fn test_full_e2e_flow() {
    get_shared_validator().expect("Failed to start validator");

    // Create test context with 3 claimants
    let ctx = TestContext::new(3).expect("Failed to create test context");
    let amounts = [100u64, 200u64, 300u64];
    let claimants = ctx.get_claimants(&amounts).expect("Failed to get claimants");
    ctx.create_csv(&claimants).expect("Failed to create CSV");

    // Fund all accounts
    let authority_pubkey = ctx.authority_pubkey().expect("Failed to get authority pubkey");
    fund_account(&authority_pubkey, 10).expect("Failed to fund authority");
    for claimant in &claimants {
        fund_account(&claimant.address, 1).expect("Failed to fund claimant");
    }

    // Step 1: Create airdrop
    println!("\n=== Step 1: Create Airdrop ===");
    let output = run_cli_success(&["create-airdrop", "--input", ctx.csv_path.to_str().unwrap()])
        .expect("create-airdrop failed");
    println!("{}", output);

    let cwd_json = std::env::current_dir().unwrap().join("airdrop.json");
    if cwd_json.exists() {
        std::fs::copy(&cwd_json, &ctx.json_path).expect("Failed to copy airdrop.json");
        std::fs::remove_file(&cwd_json).ok();
    }

    // Step 2: Deploy airdrop
    println!("\n=== Step 2: Deploy Airdrop ===");
    let output = run_cli_success(&[
        "deploy-airdrop",
        "--json",
        ctx.json_path.to_str().unwrap(),
        "--network",
        "localnet",
        "--keypair",
        ctx.authority_keypair_path.to_str().unwrap(),
        "--program-id",
        PROGRAM_ID,
    ])
    .expect("deploy-airdrop failed");
    println!("{}", output);

    // Step 3: Each claimant claims
    println!("\n=== Step 3: Claims ===");
    for (i, claimant) in claimants.iter().enumerate() {
        println!("\n--- Claimant {} (amount: {}) ---", i, claimant.amount);

        let output = run_cli_success(&[
            "claim-airdrop",
            "--json",
            ctx.json_path.to_str().unwrap(),
            "--network",
            "localnet",
            "--keypair",
            claimant.keypair_path.to_str().unwrap(),
            "--program-id",
            PROGRAM_ID,
        ])
        .expect(&format!("Claim {} failed", i));

        println!("{}", output);

        assert!(
            output.contains("Airdrop claimed successfully"),
            "Claimant {} should claim successfully",
            i
        );
    }

    println!("\n=== Full E2E flow completed successfully! ===");
}

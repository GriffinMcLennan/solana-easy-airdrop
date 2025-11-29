use airdrop_contract::accounts::Claim;
use anchor_client::solana_sdk::commitment_config::CommitmentConfig;
use anchor_client::solana_sdk::pubkey::Pubkey;
use anchor_client::solana_sdk::signature::{read_keypair_file, Keypair, Signer};
use anchor_client::Client;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::spl_token;
use anyhow::{Context, Result};
use serde::Deserialize;
use std::{fs::File, path::PathBuf, rc::Rc, str::FromStr};

use crate::instructions::deploy_airdrop::Network;

const CLAIM_RECEIPT_SEED: &[u8] = b"receipt";

#[derive(Deserialize)]
struct ClaimInfo {
    amount: String,
    leaf_index: u64,
}

#[derive(Deserialize)]
struct AirdropJson {
    merkle_root: [u8; 32],
    merkle_tree: Vec<Vec<u8>>,
    claims: std::collections::BTreeMap<String, ClaimInfo>,
    #[serde(default)]
    mint: Option<String>,
}

#[derive(Debug)]
pub struct ClaimAirdropArgs {
    pub json_path: PathBuf,
    pub mint: Option<String>,
    pub address: Option<String>,
    pub network: Network,
    pub program_id: String,
    pub keypair_path: PathBuf,
}

/// Generate a merkle proof for the given leaf index
fn generate_proof(merkle_tree: &[Vec<u8>], leaf_index: u64) -> Vec<[u8; 32]> {
    let mut proof: Vec<[u8; 32]> = Vec::new();
    let mut index = leaf_index as usize;

    while index > 1 {
        let sibling_index = if index % 2 == 0 { index + 1 } else { index - 1 };
        if sibling_index < merkle_tree.len() {
            let sibling = &merkle_tree[sibling_index];
            let mut arr = [0u8; 32];
            arr.copy_from_slice(sibling);
            proof.push(arr);
        }
        index /= 2;
    }

    proof
}

pub fn claim_airdrop(args: ClaimAirdropArgs) -> Result<()> {
    // Read and parse the airdrop JSON
    let file = File::open(&args.json_path)
        .with_context(|| format!("Failed to open {:?}", args.json_path))?;
    let airdrop_data: AirdropJson = serde_json::from_reader(file).with_context(|| {
        format!(
            "Failed to parse airdrop JSON from {:?}. Make sure you're using an airdrop.json file.",
            args.json_path
        )
    })?;

    let merkle_root_hash = airdrop_data.merkle_root;
    let program_id = Pubkey::from_str(&args.program_id)?;

    // Determine mint - either from args or from JSON
    let mint = match &args.mint {
        Some(mint_str) => Pubkey::from_str(mint_str)?,
        None => {
            let mint_str = airdrop_data.mint.as_ref().ok_or_else(|| {
                anyhow::anyhow!(
                    "No mint address found. Either provide --mint or run deploy-airdrop first to populate the mint in the JSON."
                )
            })?;
            Pubkey::from_str(mint_str)
                .map_err(|e| anyhow::anyhow!("Invalid mint address in JSON: {}", e))?
        }
    };

    // Load keypair
    let payer = read_keypair_file(&args.keypair_path)
        .map_err(|e| anyhow::anyhow!("Failed to read keypair from {:?}: {}", args.keypair_path, e))?;

    // Determine the claiming address (either from args or from keypair)
    let claiming_address = match &args.address {
        Some(addr) => Pubkey::from_str(addr)?,
        None => payer.pubkey(),
    };

    println!("Merkle root: {}", hex::encode(merkle_root_hash));
    println!("Network: {}", args.network.name());
    println!("Program ID: {}", program_id);
    println!("Mint: {}", mint);
    println!("Claiming address: {}", claiming_address);

    // Look up the claim info for this address
    let claim_info = airdrop_data
        .claims
        .get(&claiming_address.to_string())
        .ok_or_else(|| {
            anyhow::anyhow!(
                "Address {} not found in airdrop. Available addresses:\n{}",
                claiming_address,
                airdrop_data
                    .claims
                    .keys()
                    .map(|k| format!("  - {}", k))
                    .collect::<Vec<_>>()
                    .join("\n")
            )
        })?;

    let amount: u64 = claim_info
        .amount
        .parse()
        .with_context(|| "Failed to parse claim amount")?;
    let leaf_index = claim_info.leaf_index;

    println!("Claim amount: {}", amount);
    println!("Leaf index: {}", leaf_index);

    // Generate the proof
    let proof = generate_proof(&airdrop_data.merkle_tree, leaf_index);
    println!("Proof length: {} nodes", proof.len());

    // Create Anchor client
    let client = Client::new_with_options(
        args.network.to_cluster(),
        Rc::new(Keypair::try_from(payer.to_bytes().as_ref())?),
        CommitmentConfig::confirmed(),
    );
    let program = client.program(program_id)?;

    // Derive PDAs
    let (merkle_root_pda, _bump) = Pubkey::find_program_address(
        &[b"merkle_root", &merkle_root_hash],
        &program_id,
    );

    let (claim_receipt_pda, _bump) = Pubkey::find_program_address(
        &[CLAIM_RECEIPT_SEED, merkle_root_pda.as_ref(), claiming_address.as_ref()],
        &program_id,
    );

    let authority_token_account = get_associated_token_address(&claiming_address, &mint);
    let merkle_root_token_account = get_associated_token_address(&merkle_root_pda, &mint);

    println!("\nMerkle root PDA: {}", merkle_root_pda);
    println!("Claim receipt PDA: {}", claim_receipt_pda);
    println!("Authority token account: {}", authority_token_account);
    println!("Merkle root token account: {}", merkle_root_token_account);

    println!("\nSending claim transaction...");

    // Build and send transaction
    let signature = program
        .request()
        .accounts(Claim {
            authority: claiming_address,
            authority_token_account,
            merkle_root_token_account,
            mint,
            merkle_root: merkle_root_pda,
            claim_receipt: claim_receipt_pda,
            system_program: anchor_client::solana_sdk::system_program::ID,
            token_program: spl_token::ID,
            associated_token_program: anchor_spl::associated_token::ID,
        })
        .args(airdrop_contract::instruction::Claim {
            proof,
            amount,
            leaf_index: leaf_index as u32,
        })
        .send()?;

    println!("\nAirdrop claimed successfully!");
    println!("Signature: {}", signature);
    println!(
        "Explorer: https://explorer.solana.com/tx/{}?cluster={}",
        signature,
        args.network.name()
    );

    Ok(())
}


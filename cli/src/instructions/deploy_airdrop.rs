use airdrop_contract::accounts::CreateAirdrop;
use anchor_client::solana_sdk::commitment_config::CommitmentConfig;
use anchor_client::solana_sdk::pubkey::Pubkey;
use anchor_client::solana_sdk::signature::{read_keypair_file, Signer};
#[allow(deprecated)]
use solana_sdk::system_program;
use anchor_client::Client;
use anchor_client::Cluster;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::spl_token;
use anyhow::{Context, Result};
use serde::Deserialize;
use std::{fs::File, path::PathBuf, rc::Rc, str::FromStr};

// Default program ID from Anchor.toml
const DEFAULT_PROGRAM_ID: &str = "F6fHBUyYyaW14CxjSnJjLck8vMmWew3PbCnt5TMqRdZX";

#[derive(Deserialize)]
struct AirdropJson {
    merkle_root: [u8; 32],
    #[allow(dead_code)]
    merkle_tree: Vec<Vec<u8>>,
    #[allow(dead_code)]
    claims: std::collections::BTreeMap<String, serde_json::Value>,
}

#[derive(Clone, Copy, Debug)]
pub enum Network {
    Devnet,
    Testnet,
    Mainnet,
    Localnet,
}

impl FromStr for Network {
    type Err = anyhow::Error;
    fn from_str(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "devnet" => Ok(Network::Devnet),
            "testnet" => Ok(Network::Testnet),
            "mainnet" | "mainnet-beta" => Ok(Network::Mainnet),
            "localnet" | "localhost" => Ok(Network::Localnet),
            _ => anyhow::bail!("Invalid network: {}. Use devnet, testnet, mainnet, or localnet", s),
        }
    }
}

impl Network {
    fn to_cluster(&self) -> Cluster {
        match self {
            Network::Devnet => Cluster::Devnet,
            Network::Testnet => Cluster::Testnet,
            Network::Mainnet => Cluster::Mainnet,
            Network::Localnet => Cluster::Localnet,
        }
    }

    fn name(&self) -> &'static str {
        match self {
            Network::Devnet => "devnet",
            Network::Testnet => "testnet",
            Network::Mainnet => "mainnet",
            Network::Localnet => "localnet",
        }
    }
}

#[derive(Debug)]
pub struct DeployAirdropArgs {
    pub json_path: PathBuf,
    pub mint: String,
    pub amount: u64,
    pub network: Network,
    pub program_id: String,
    pub keypair_path: PathBuf,
}

pub fn deploy_airdrop(args: DeployAirdropArgs) -> Result<()> {
    // Read and parse the airdrop JSON
    let file = File::open(&args.json_path)
        .with_context(|| format!("Failed to open {:?}", args.json_path))?;
    let airdrop_data: AirdropJson =
        serde_json::from_reader(file).with_context(|| "Failed to parse airdrop JSON")?;

    let merkle_root_hash = airdrop_data.merkle_root;
    let program_id = Pubkey::from_str(&args.program_id)?;
    let mint = Pubkey::from_str(&args.mint)?;

    println!("Merkle root: {}", hex::encode(merkle_root_hash));
    println!("Network: {}", args.network.name());
    println!("Program ID: {}", program_id);
    println!("Mint: {}", mint);
    println!("Amount: {}", args.amount);

    // Load keypair
    let payer = read_keypair_file(&args.keypair_path)
        .map_err(|e| anyhow::anyhow!("Failed to read keypair from {:?}: {}", args.keypair_path, e))?;

    println!("Payer: {}", payer.pubkey());

    // Create Anchor client
    let client = Client::new_with_options(
        args.network.to_cluster(),
        Rc::new(payer),
        CommitmentConfig::confirmed(),
    );
    let program = client.program(program_id)?;

    // Derive PDAs
    let (merkle_root_pda, _bump) = Pubkey::find_program_address(
        &[b"merkle_root", &merkle_root_hash],
        &program_id,
    );

    let authority = program.payer();
    let authority_token_account = get_associated_token_address(&authority, &mint);
    let merkle_root_token_account = get_associated_token_address(&merkle_root_pda, &mint);

    println!("Merkle root PDA: {}", merkle_root_pda);
    println!("Authority token account: {}", authority_token_account);
    println!("Merkle root token account: {}", merkle_root_token_account);

    println!("\nSending transaction...");

    // Build and send transaction using the program's instruction
    let signature = program
        .request()
        .accounts(CreateAirdrop {
            authority: authority,
            authority_token_account,
            merkle_root_token_account,
            mint,
            merkle_root: merkle_root_pda,
            system_program: system_program::ID,
            token_program: spl_token::ID,
            associated_token_program: anchor_spl::associated_token::ID,
        })
        .args(airdrop_contract::instruction::CreateAirdrop {
            merkle_root_hash,
            amount: args.amount,
        })
        .send()?;

    println!("\nAirdrop deployed successfully!");
    println!("Signature: {}", signature);
    println!(
        "Explorer: https://explorer.solana.com/tx/{}?cluster={}",
        signature,
        args.network.name()
    );

    Ok(())
}

pub fn get_default_program_id() -> String {
    DEFAULT_PROGRAM_ID.to_string()
}

pub fn get_default_keypair_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".config/solana/id.json")
}

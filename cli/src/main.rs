mod instructions;
use anyhow::Result;
use clap::{Parser, Subcommand};
use std::path::PathBuf;

/// Simple CLI for Solana Easy Airdrop utilities
#[derive(Parser)]
#[command(author, version, about)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Construct a Merkle-tree root from a CSV file that contains `address,amount` rows.
    CreateAirdrop {
        /// Path to CSV file (with header `address,amount`)
        #[arg(long, value_name = "FILE")]
        input: PathBuf,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Commands::CreateAirdrop { input } => {
            instructions::create_airdrop(&input)?;
        }
    }
    Ok(())
}

// Build Merkle tree
// fn compute_merkle_root(csv_path: &PathBuf) -> Result<[u8; 32]> {
//     let file = File::open(csv_path).with_context(|| format!("Failed to open {:?}", csv_path))?;
//     let mut rdr = csv::Reader::from_reader(file);

//     // Expect header address,amount
//     let mut leaves = Vec::new();
//     for result in rdr.records() {
//         let record: StringRecord = result?;
//         let address = record.get(0).context("missing address field")?;
//         let amount = record.get(1).context("missing amount field")?;
//         let leaf_bytes = [address.as_bytes(), amount.as_bytes()].concat();
//         leaves.push(hash(&leaf_bytes));
//     }

//     if leaves.is_empty() {
//         anyhow::bail!("CSV contains no rows");
//     }

//     while leaves.len() > 1 {
//         // If odd number of leaves, append empty data leaf
//         if leaves.len() % 2 == 1 {
//             leaves.push([0u8; 32]);
//         }

//         let mut next_level = Vec::with_capacity(leaves.len() / 2);
//         for chunk in leaves.chunks(2) {
//             let combined = [chunk[0].as_slice(), chunk[1].as_slice()].concat();
//             next_level.push(hash(&combined));
//         }
//         leaves = next_level;
//     }
//     Ok(leaves[0])
// }

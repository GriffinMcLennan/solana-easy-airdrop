mod instructions;
use anyhow::Result;
use clap::{Parser, Subcommand};
use std::path::PathBuf;

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
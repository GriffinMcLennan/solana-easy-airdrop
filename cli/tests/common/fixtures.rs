use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use tempfile::TempDir;

/// Test context containing temporary directories and keypair paths
pub struct TestContext {
    #[allow(dead_code)] // Kept to ensure TempDir lives as long as the context
    pub temp_dir: TempDir,
    pub authority_keypair_path: PathBuf,
    pub claimant_keypair_paths: Vec<PathBuf>,
    pub csv_path: PathBuf,
    pub json_path: PathBuf,
}

/// Claimant info for test generation
pub struct TestClaimant {
    pub address: String,
    pub amount: u64,
    pub keypair_path: PathBuf,
}

impl TestContext {
    /// Create a new test context with generated keypairs
    pub fn new(num_claimants: usize) -> Result<Self, Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;

        // Generate authority keypair
        let authority_keypair_path = temp_dir.path().join("authority.json");
        generate_keypair(&authority_keypair_path)?;

        // Generate claimant keypairs
        let mut claimant_keypair_paths = Vec::new();
        for i in 0..num_claimants {
            let path = temp_dir.path().join(format!("claimant_{}.json", i));
            generate_keypair(&path)?;
            claimant_keypair_paths.push(path);
        }

        let csv_path = temp_dir.path().join("test_airdrop.csv");
        let json_path = temp_dir.path().join("airdrop.json");

        Ok(Self {
            temp_dir,
            authority_keypair_path,
            claimant_keypair_paths,
            csv_path,
            json_path,
        })
    }

    /// Get the authority public key
    pub fn authority_pubkey(&self) -> Result<String, Box<dyn std::error::Error>> {
        get_pubkey(&self.authority_keypair_path)
    }

    /// Get test claimants with their addresses and amounts
    pub fn get_claimants(
        &self,
        amounts: &[u64],
    ) -> Result<Vec<TestClaimant>, Box<dyn std::error::Error>> {
        if amounts.len() != self.claimant_keypair_paths.len() {
            return Err("Amount count must match claimant count".into());
        }

        let mut claimants = Vec::new();
        for (i, amount) in amounts.iter().enumerate() {
            let address = get_pubkey(&self.claimant_keypair_paths[i])?;
            claimants.push(TestClaimant {
                address,
                amount: *amount,
                keypair_path: self.claimant_keypair_paths[i].clone(),
            });
        }
        Ok(claimants)
    }

    /// Create a CSV file with the given claimants
    pub fn create_csv(&self, claimants: &[TestClaimant]) -> Result<(), Box<dyn std::error::Error>> {
        let mut file = File::create(&self.csv_path)?;
        writeln!(file, "address,amount")?;
        for claimant in claimants {
            writeln!(file, "{},{}", claimant.address, claimant.amount)?;
        }
        Ok(())
    }

    /// Read the generated airdrop.json
    pub fn read_airdrop_json(&self) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(&self.json_path)?;
        let json: serde_json::Value = serde_json::from_str(&content)?;
        Ok(json)
    }
}

/// Generate a new Solana keypair at the given path
fn generate_keypair(path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    let status = Command::new("solana-keygen")
        .args([
            "new",
            "--no-bip39-passphrase",
            "--force",
            "-o",
            path.to_str().unwrap(),
        ])
        .output()?;

    if !status.status.success() {
        return Err(format!(
            "Failed to generate keypair: {}",
            String::from_utf8_lossy(&status.stderr)
        )
        .into());
    }
    Ok(())
}

/// Get the public key from a keypair file
fn get_pubkey(keypair_path: &PathBuf) -> Result<String, Box<dyn std::error::Error>> {
    let output = Command::new("solana-keygen")
        .args(["pubkey", keypair_path.to_str().unwrap()])
        .output()?;

    if !output.status.success() {
        return Err(format!(
            "Failed to get pubkey: {}",
            String::from_utf8_lossy(&output.stderr)
        )
        .into());
    }

    Ok(String::from_utf8(output.stdout)?.trim().to_string())
}

/// Get the CLI binary path
pub fn cli_binary_path() -> PathBuf {
    // Use CARGO_BIN_EXE_cli which is set by cargo test
    PathBuf::from(env!("CARGO_BIN_EXE_cli"))
}

/// Run a CLI command and return the output
pub fn run_cli(args: &[&str]) -> Result<std::process::Output, Box<dyn std::error::Error>> {
    let output = Command::new(cli_binary_path()).args(args).output()?;
    Ok(output)
}

/// Run CLI command and assert success
pub fn run_cli_success(args: &[&str]) -> Result<String, Box<dyn std::error::Error>> {
    let output = run_cli(args)?;
    if !output.status.success() {
        return Err(format!(
            "CLI command failed: {}\nstdout: {}\nstderr: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        )
        .into());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

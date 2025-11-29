use std::process::{Child, Command, Stdio};
use std::sync::OnceLock;
use std::thread;
use std::time::{Duration, Instant};
use tempfile::TempDir;

// Note: Child and TempDir are used in SharedValidator struct

pub const PROGRAM_ID: &str = "F6fHBUyYyaW14CxjSnJjLck8vMmWew3PbCnt5TMqRdZX";
pub const RPC_URL: &str = "http://localhost:8899";

/// Global shared validator instance - started once, reused across all tests
static SHARED_VALIDATOR: OnceLock<SharedValidator> = OnceLock::new();

struct SharedValidator {
    _process: Child,
    _ledger_dir: TempDir,
}

/// Get or start the shared validator instance
pub fn get_shared_validator() -> Result<(), Box<dyn std::error::Error>> {
    SHARED_VALIDATOR.get_or_init(|| {
        let ledger_dir = TempDir::new().expect("Failed to create temp dir");
        let so_path = get_program_so_path();

        let process = Command::new("solana-test-validator")
            .arg("--bpf-program")
            .arg(PROGRAM_ID)
            .arg(&so_path)
            .arg("--ledger")
            .arg(ledger_dir.path())
            .arg("--reset")
            .arg("--quiet")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("Failed to start validator");

        // Wait for validator to be ready
        let start = Instant::now();
        while start.elapsed() < Duration::from_secs(30) {
            if Command::new("solana")
                .args(["cluster-version", "-u", RPC_URL])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map(|s| s.success())
                .unwrap_or(false)
            {
                break;
            }
            thread::sleep(Duration::from_millis(200));
        }

        SharedValidator {
            _process: process,
            _ledger_dir: ledger_dir,
        }
    });
    Ok(())
}

/// Path to the compiled airdrop contract .so file
fn get_program_so_path() -> String {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    format!(
        "{}/airdrop-contract/target/deploy/airdrop_contract.so",
        std::path::Path::new(manifest_dir)
            .parent()
            .unwrap()
            .display()
    )
}

/// Fund an account with SOL using solana airdrop command
pub fn fund_account(address: &str, amount_sol: u64) -> Result<(), Box<dyn std::error::Error>> {
    let output = Command::new("solana")
        .args(["airdrop", &amount_sol.to_string(), address, "-u", RPC_URL])
        .output()?;

    if !output.status.success() {
        return Err(format!(
            "Failed to airdrop {} SOL to {}: {}",
            amount_sol,
            address,
            String::from_utf8_lossy(&output.stderr)
        )
        .into());
    }

    // Brief wait for confirmation on test validator
    thread::sleep(Duration::from_millis(500));
    Ok(())
}

/// Verify a program is loaded on the validator
pub fn verify_program_loaded(program_id: &str) -> Result<(), Box<dyn std::error::Error>> {
    let output = Command::new("solana")
        .args(["program", "show", program_id, "-u", RPC_URL])
        .output()?;

    if !output.status.success() {
        return Err(format!(
            "Program {} is not loaded on the validator.\nstderr: {}",
            program_id,
            String::from_utf8_lossy(&output.stderr)
        )
        .into());
    }

    Ok(())
}

use std::process::{Child, Command, Stdio};
use std::sync::OnceLock;
use std::thread;
use std::time::{Duration, Instant};
use tempfile::TempDir;

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

/// Manages a solana-test-validator process for integration testing
pub struct TestValidator {
    process: Child,
    #[allow(dead_code)]
    ledger_dir: TempDir,
}

impl TestValidator {
    /// Start a new test validator with the airdrop program preloaded
    pub fn start() -> Result<Self, Box<dyn std::error::Error>> {
        let ledger_dir = TempDir::new()?;
        let so_path = get_program_so_path();

        // Check if .so file exists
        if !std::path::Path::new(&so_path).exists() {
            return Err(format!(
                "Program .so file not found at: {}\nRun 'anchor build' in airdrop-contract/ first",
                so_path
            )
            .into());
        }

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
            .spawn()?;

        let validator = Self { process, ledger_dir };

        // Wait for validator to be ready
        validator.wait_for_ready(Duration::from_secs(30))?;

        Ok(validator)
    }

    /// Wait for the validator RPC to be ready
    fn wait_for_ready(&self, timeout: Duration) -> Result<(), Box<dyn std::error::Error>> {
        let start = Instant::now();

        while start.elapsed() < timeout {
            // Try to connect to RPC
            let result = std::process::Command::new("solana")
                .args(["cluster-version", "-u", RPC_URL])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();

            if let Ok(status) = result {
                if status.success() {
                    return Ok(());
                }
            }

            thread::sleep(Duration::from_millis(500));
        }

        Err(format!("Validator did not become ready within {:?}", timeout).into())
    }

    pub fn rpc_url(&self) -> &'static str {
        RPC_URL
    }
}

impl Drop for TestValidator {
    fn drop(&mut self) {
        let _ = self.process.kill();
        let _ = self.process.wait();
    }
}

/// Fund an account with SOL using solana airdrop command
pub fn fund_account(address: &str, amount_sol: u64) -> Result<(), Box<dyn std::error::Error>> {
    // Retry logic for airdrops which can be flaky on test validators
    let mut attempts = 0;
    let max_attempts = 5;

    while attempts < max_attempts {
        let output = Command::new("solana")
            .args(["airdrop", &amount_sol.to_string(), address, "-u", RPC_URL])
            .output()?;

        if output.status.success() {
            // Wait for transaction to be confirmed
            thread::sleep(Duration::from_secs(1));

            // Verify the account has balance
            let balance_output = Command::new("solana")
                .args(["balance", address, "-u", RPC_URL])
                .output()?;

            let balance_str = String::from_utf8_lossy(&balance_output.stdout);
            if balance_output.status.success() && !balance_str.trim().starts_with("0 SOL") {
                // Extra delay to ensure the airdrop is fully confirmed
                thread::sleep(Duration::from_secs(2));
                return Ok(());
            }
        }

        attempts += 1;
        if attempts < max_attempts {
            thread::sleep(Duration::from_secs(2));
        }
    }

    Err(format!(
        "Failed to airdrop {} SOL to {} after {} attempts",
        amount_sol, address, max_attempts
    )
    .into())
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

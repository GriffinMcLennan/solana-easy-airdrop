# CLI Integration Tests

End-to-end tests that verify all CLI commands work correctly against a real Solana validator.

## Quick Start

```bash
# Build the contract first (required)
cd airdrop-contract && anchor build

# Run integration tests
cd cli && cargo test --test integration_tests
```

## Architecture

### Why Real Validator Instead of Mocks?

The CLI uses `RpcClient` for all Solana interactions, which requires a real HTTP endpoint. While Solana provides `solana-program-test` (BanksClient) for in-process testing, it doesn't expose an RPC endpoint—so it can't test CLI commands that shell out to a binary.

We use `solana-test-validator` which:

- Provides a real RPC endpoint at `localhost:8899`
- Can preload our program via `--bpf-program` (faster than deploying)
- Behaves identically to devnet/mainnet

### Shared Validator Pattern

Starting a validator takes ~3-5 seconds. If each test started its own validator, a 7-test suite would spend 20-30 seconds just on startup overhead.

Instead, we use a **shared validator** via Rust's `OnceLock`:

```
First test runs  → Validator starts (3-5s) → Test executes
Second test runs → Validator already running → Test executes immediately
...
All tests done   → Validator cleaned up automatically
```

This brings total runtime from ~50s down to ~16s.

#### How OnceLock Works

`OnceLock` is a thread-safe primitive from `std::sync` that guarantees a value is initialized exactly once, even when multiple threads try to initialize it simultaneously.

```rust
static SHARED_VALIDATOR: OnceLock<SharedValidator> = OnceLock::new();

pub fn get_shared_validator() -> Result<()> {
    SHARED_VALIDATOR.get_or_init(|| {
        // This closure runs exactly once, on first call
        // Subsequent calls return the existing value immediately
        start_validator()
    });
    Ok(())
}
```

This is perfect for test fixtures because:

- **Lazy initialization** - Validator only starts if tests actually need it
- **Thread-safe** - Works correctly even with parallel test execution
- **Zero overhead after init** - `get_or_init` is just a pointer read after first call
- **Automatic cleanup** - The validator process is killed when the test binary exits

We use `OnceLock` over alternatives like `lazy_static!` because it's in the standard library (no extra dependencies) and has clearer semantics for fallible initialization.

### Commitment Level Fix

The CLI originally used `RpcClient::new()` which defaults to `finalized` commitment. On test-validator, transactions confirm almost instantly but may take longer to finalize. This caused a race condition where:

1. Test airdrops SOL to an account
2. CLI tries to deploy, simulating against `finalized` state
3. Simulation fails because airdrop isn't finalized yet

Fixed by using `confirmed` commitment in the CLI's RpcClient, matching how the TypeScript SDK handles this.

## Test Structure

```
cli/tests/
├── integration_tests.rs    # All test cases
├── common/
│   ├── mod.rs              # Module exports
│   ├── validator.rs        # Shared validator + funding utilities
│   └── fixtures.rs         # Test context (keypairs, CSV generation)
```

### What Each Test Covers

| Test                      | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `test_create_airdrop_*`   | Merkle tree generation from CSV               |
| `test_deploy_airdrop_*`   | On-chain deployment, mint creation            |
| `test_claim_airdrop_*`    | Token claiming with merkle proofs             |
| `test_double_claim_fails` | Verifies claim receipts prevent double-claims |
| `test_full_e2e_flow`      | Complete flow with multiple claimants         |

## Test Isolation

Each test gets its own:

- Temporary directory (cleaned up automatically)
- Fresh keypairs (authority + claimants)
- Unique merkle tree (different addresses = different root)

This means tests don't interfere with each other even though they share a validator. Each airdrop has a unique PDA derived from its merkle root.

## Prerequisites

- `solana-test-validator` installed (comes with Solana CLI)
- Contract built (`anchor build` in airdrop-contract/)
- The `.so` file must exist at `airdrop-contract/target/deploy/airdrop_contract.so`

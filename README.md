# Solana Easy Airdrop

A merkle tree-based token airdrop system for Solana. Create airdrops from a CSV file, deploy on-chain, and allow users to claim their tokens with cryptographic proofs.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CSV File  │────▶│     CLI     │────▶│ airdrop.json│
│ (addresses) │     │ (merkle gen)│     │ (tree data) │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Server    │◀────│ airdrop.json│     │  Contract   │
│ (proofs API)│     │             │     │  (on-chain) │
└──────┬──────┘     └─────────────┘     └──────▲──────┘
       │                                       │
       │            ┌─────────────┐            │
       └───────────▶│   Web App   │────────────┘
                    │(create/claim)│
                    └─────────────┘
```

## Components

| Directory | Description |
|-----------|-------------|
| `cli/` | Rust CLI tool to generate merkle trees from CSV files |
| `airdrop-contract/` | Anchor smart contract for on-chain airdrop management |
| `server/` | Express server that serves merkle proofs to claimants |
| `web/` | React frontend for creating and claiming airdrops |

## Prerequisites

- [Rust](https://rustup.rs/) (for CLI and contract)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (v1.18+)
- [Anchor](https://www.anchor-lang.com/docs/installation) (v0.31+)
- [Node.js](https://nodejs.org/) (v18+)
- [Bun](https://bun.sh/) (for server)
- [pnpm](https://pnpm.io/) (for web)

## Rust Toolchain Setup

This project requires two different Rust toolchains due to Solana/Anchor constraints:

1. **`solana` toolchain** (rustc 1.84+) - Used by the CLI for `anchor-client` and `solana-sdk` dependencies
2. **Rust 1.79.0** - Used by Anchor for building the on-chain program (BPF compilation)

### Why Two Toolchains?

- The CLI uses `anchor-client` to interact with the deployed program, which depends on `solana-sdk` 2.x
- `solana-sdk` 2.x requires Rust 1.83+
- Anchor's BPF compiler (`cargo-build-sbf`) requires Rust 1.79.0
- These can't use the same toolchain, so each directory has its own `rust-toolchain.toml`

### Toolchain Files

| File | Toolchain | Purpose |
|------|-----------|---------|
| `/rust-toolchain.toml` | `solana` | CLI builds (solana-sdk 2.x compatible) |
| `/airdrop-contract/rust-toolchain.toml` | `1.79.0` | Anchor/BPF builds |

### Installing the Solana Toolchain

The `solana` toolchain is installed automatically when you install Anchor/Solana CLI tools. Verify with:

```bash
rustup run solana rustc --version  # Should show 1.84.x
```

### IDE Setup (VS Code)

rust-analyzer may have issues with the `solana` toolchain's proc-macro server. The `.vscode/settings.json` configures rust-analyzer to use the `stable` toolchain for analysis while builds still use the correct toolchain:

```json
{
    "rust-analyzer.server.extraEnv": {
        "RUSTUP_TOOLCHAIN": "stable"
    }
}
```

This means IDE features (autocomplete, error checking) use `stable`, but `cargo build` respects `rust-toolchain.toml`.

## Quick Start

### 1. Generate Merkle Tree from CSV

Create a CSV file with `address,amount` format:

```csv
address,amount
FEHVBLQa7gYKdVT3jc2NQviSs3EgzTyD3k2yyPm5pTXP,100
31HrWnNNM3QvZYNqN2F1CqWE2iiYfCV1pvLvTeZwyHBS,20
7N3h2Zp4i9DzRbRGjtJHnRXnUbjKxLpsCnxmz7RLS1qZ,30
```

Run the CLI to generate the merkle tree:

```bash
cd cli
cargo run -- create-airdrop --input ../airdrop_example.csv
```

This creates `airdrop.json` containing:
- `merkle_root`: The 32-byte root hash
- `merkle_tree`: Full tree for proof generation
- `claims`: Mapping of addresses to amounts and leaf indices

### 2. Deploy the Contract

Start a local Solana validator:

```bash
solana-test-validator
```

In another terminal, build and deploy the contract:

```bash
cd airdrop-contract
anchor build
anchor deploy
```

Note the program ID from the deployment output. It should match the ID in `Anchor.toml`:
```
F6fHBUyYyaW14CxjSnJjLck8vMmWew3PbCnt5TMqRdZX
```

### 3. Set Up the Server

Copy the generated `airdrop.json` to the server:

```bash
cp cli/airdrop.json server/airdrop_jsons/
```

Install dependencies and start the server:

```bash
cd server
bun install
bun run start
```

The server runs on `http://localhost:5000` and exposes:
- `GET /api/airdrop/:rootHex/:address` - Returns claim data and merkle proof

### 4. Set Up the Web App

Configure environment:

```bash
cd web
cp .env.example .env
```

Edit `.env` if needed:
```
VITE_AIRDROP_SERVER_URL=http://localhost:5000
```

Install dependencies and start:

```bash
pnpm install
pnpm dev
```

The web app runs on `http://localhost:5173`.

## Usage

### Creating an Airdrop

1. Connect your wallet in the web app
2. Enter the merkle root (from `airdrop.json`)
3. Enter the total airdrop amount
4. Click "Create Airdrop"

This will:
- Create a new SPL token mint
- Mint tokens to your wallet
- Initialize the on-chain airdrop with the merkle root

### Claiming an Airdrop

1. Connect your wallet (must be an address in the original CSV)
2. Enter the merkle root for the airdrop
3. Click "Claim Airdrop"

The app will:
- Fetch your proof from the server
- Submit the claim transaction with the proof
- Transfer your allocated tokens

## Development

### Running Tests

CLI tests:
```bash
cd cli
cargo test
```

Contract tests:
```bash
cd airdrop-contract
anchor test
```

### Project Structure

```
solana-easy-airdrop/
├── airdrop_example.csv      # Example airdrop CSV
├── cli/
│   └── src/
│       ├── main.rs          # CLI entry point
│       └── instructions/
│           └── create_airdrop.rs  # Merkle tree generation
├── airdrop-contract/
│   └── programs/
│       └── airdrop-contract/
│           └── src/
│               ├── lib.rs           # Program entry
│               ├── instructions/    # create_airdrop, claim
│               ├── state/           # MerkleRoot, ClaimReceipt
│               └── errors.rs        # Custom errors
├── server/
│   ├── server.ts            # Express API
│   ├── airdrop.ts           # Proof generation logic
│   └── airdrop_jsons/       # Store airdrop JSON files here
└── web/
    └── src/
        ├── App.tsx          # Main UI
        ├── hooks/           # useCreateAirdrop, useClaimAirdrop
        └── providers/       # Solana wallet & program providers
```

## How It Works

### Merkle Tree Construction

1. Each leaf is `hash(address || amount)` where amount is u64 little-endian
2. Tree is padded to the next power of 2 with zero hashes
3. Parent nodes are `hash(left || right)`
4. Root is stored on-chain; full tree is stored on server

### Claim Verification

1. User provides `(proof, amount, leaf_index)`
2. Contract reconstructs leaf: `hash(signer_address || amount)`
3. Walks up the tree using proof siblings
4. Verifies computed root matches stored root
5. If valid, transfers tokens and creates receipt (prevents double-claim)

## Configuration

### Contract (Anchor.toml)

```toml
[programs.localnet]
airdrop_contract = "F6fHBUyYyaW14CxjSnJjLck8vMmWew3PbCnt5TMqRdZX"

[provider]
cluster = "localnet"  # or "devnet"
wallet = "~/.config/solana/id.json"
```

### Web (.env)

```
VITE_AIRDROP_SERVER_URL=http://localhost:5000
```

## License

MIT

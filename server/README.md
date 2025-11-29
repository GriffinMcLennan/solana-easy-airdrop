# Server

Express server that serves merkle proofs to airdrop claimants.

## Setup

```bash
bun install
```

Copy airdrop JSON files to `airdrop_jsons/` directory:
```bash
cp ../airdrop.json airdrop_jsons/
```

## Running

```bash
bun run start
```

Runs on http://localhost:5000.

## API

### `GET /api/airdrop/:rootHex/:address`

Returns claim data and merkle proof for an address.

**Response:**
```json
{
  "claim": {
    "amount": "100",
    "leaf_index": 0
  },
  "proof": [[...], [...]]
}
```

Each proof element is a 32-byte array.

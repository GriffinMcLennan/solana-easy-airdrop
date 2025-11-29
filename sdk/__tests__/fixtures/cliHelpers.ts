import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdtempSync, rmSync, existsSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import type { ClaimResponse } from "../../src";

export interface AirdropJson {
  merkle_root: string;
  merkle_tree: string[];
  claims: Record<string, { amount: string; leaf_index: number }>;
}

/**
 * Find the CLI binary path
 */
function findCliBinary(): string {
  const sdkDir = resolve(__dirname, "../..");
  const projectRoot = resolve(sdkDir, "..");

  // Check workspace target first (preferred), then local cli target
  const paths = [
    join(projectRoot, "target/release/cli"),
    join(projectRoot, "target/debug/cli"),
    join(projectRoot, "cli/target/release/cli"),
    join(projectRoot, "cli/target/debug/cli"),
  ];

  for (const p of paths) {
    if (existsSync(p)) return p;
  }

  throw new Error(
    `Cannot find CLI binary - run 'cargo build -p cli' first. Searched:\n${paths.join("\n")}`
  );
}

/**
 * Generate an airdrop JSON using the CLI
 */
export function generateAirdropJson(
  claimants: { address: string; amount: number }[]
): AirdropJson {
  const tempDir = mkdtempSync(join(tmpdir(), "airdrop-test-"));

  try {
    const csvPath = join(tempDir, "claimants.csv");

    // Write CSV in expected format
    let csv = "address,amount\n";
    for (const c of claimants) {
      csv += `${c.address},${c.amount}\n`;
    }
    writeFileSync(csvPath, csv);

    // Run CLI
    const cliPath = findCliBinary();
    execSync(`${cliPath} create-airdrop --input ${csvPath}`, {
      cwd: tempDir,
      stdio: "pipe",
    });

    // Read generated JSON
    const jsonPath = join(tempDir, "airdrop.json");
    return JSON.parse(readFileSync(jsonPath, "utf-8"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Convert a merkle root hex string to a number array
 */
export function merkleRootToBytes(merkleRoot: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < merkleRoot.length; i += 2) {
    bytes.push(parseInt(merkleRoot.substring(i, i + 2), 16));
  }
  return bytes;
}

/**
 * Generate claim data from the airdrop JSON (simulates what the server would return)
 */
export function getClaimDataFromJson(
  airdropJson: AirdropJson,
  address: string
): ClaimResponse {
  const claim = airdropJson.claims[address];
  if (!claim) {
    throw new Error(`Address ${address} not found in airdrop`);
  }

  const proof = generateProof(airdropJson.merkle_tree, claim.leaf_index);

  return {
    claim: {
      amount: claim.amount,
      leaf_index: claim.leaf_index,
    },
    proof,
  };
}

/**
 * Generate merkle proof for a given leaf index
 * This mirrors the logic in server/airdrop.ts
 */
function generateProof(merkleTree: string[], leafIndex: number): string[] {
  const proof: string[] = [];

  // The leaf is at position (tree.length / 2) + leafIndex in a complete binary tree
  // But in our implementation, leafIndex is 1-indexed from the leaf layer
  let index = leafIndex;

  while (index > 1) {
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    if (siblingIndex < merkleTree.length) {
      proof.push(merkleTree[siblingIndex]);
    }
    index = Math.floor(index / 2);
  }

  return proof;
}

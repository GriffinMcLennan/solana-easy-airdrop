import { spawn } from "child_process";
import { existsSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

const PROGRAM_ID = "F6fHBUyYyaW14CxjSnJjLck8vMmWew3PbCnt5TMqRdZX";
const RPC_URL = "http://localhost:8899";

// File to persist PID between globalSetup and globalTeardown (they run in separate processes)
export const VALIDATOR_PID_FILE = join(tmpdir(), "solana-test-validator.pid");

async function isValidatorRunning(): Promise<boolean> {
  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForValidator(timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isValidatorRunning()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Validator failed to start within timeout");
}

function findProgramSo(): string {
  // Try multiple possible paths relative to the sdk directory
  const sdkDir = resolve(__dirname, "../..");
  const projectRoot = resolve(sdkDir, "..");

  const paths = [
    join(projectRoot, "airdrop-contract/target/deploy/airdrop_contract.so"),
  ];

  for (const p of paths) {
    if (existsSync(p)) return p;
  }

  throw new Error(
    `Cannot find airdrop_contract.so - run 'anchor build' first. Searched:\n${paths.join("\n")}`
  );
}

export async function setup() {
  // Check if validator is already running
  if (await isValidatorRunning()) {
    console.log("Validator already running, reusing...");
    // Clear PID file since we didn't start this validator
    writeFileSync(VALIDATOR_PID_FILE, "");
    return;
  }

  console.log("Starting solana-test-validator...");

  const ledgerDir = join(tmpdir(), `solana-test-${Date.now()}`);
  const soPath = findProgramSo();

  const validatorProcess = spawn(
    "solana-test-validator",
    [
      "--bpf-program",
      PROGRAM_ID,
      soPath,
      "--ledger",
      ledgerDir,
      "--reset",
      "--quiet",
    ],
    { stdio: "ignore", detached: true }
  );

  // Persist PID and ledger dir to file for teardown (globalThis doesn't persist between processes)
  const pidData = JSON.stringify({
    pid: validatorProcess.pid,
    ledgerDir,
  });
  writeFileSync(VALIDATOR_PID_FILE, pidData);

  // Don't wait for the parent process
  validatorProcess.unref();

  await waitForValidator(30000);
  console.log("Validator started successfully");
}

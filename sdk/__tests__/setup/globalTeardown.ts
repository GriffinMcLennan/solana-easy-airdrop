import { existsSync, readFileSync, rmSync, unlinkSync } from "fs";
import { VALIDATOR_PID_FILE } from "./globalSetup";

export async function teardown() {
  let pid: number | undefined;
  let ledgerDir: string | undefined;

  // Read PID from file (globalThis doesn't persist between setup and teardown processes)
  if (existsSync(VALIDATOR_PID_FILE)) {
    try {
      const content = readFileSync(VALIDATOR_PID_FILE, "utf-8").trim();
      if (content) {
        const data = JSON.parse(content);
        pid = data.pid;
        ledgerDir = data.ledgerDir;
      }
      unlinkSync(VALIDATOR_PID_FILE);
    } catch (e) {
      // File may be empty or malformed
    }
  }

  if (pid) {
    try {
      process.kill(pid, "SIGTERM");
      console.log(`Killed validator process ${pid}`);
    } catch (e) {
      // Process may already be dead
    }
  }

  if (ledgerDir) {
    try {
      rmSync(ledgerDir, { recursive: true, force: true });
      console.log(`Cleaned up ledger directory ${ledgerDir}`);
    } catch (e) {
      // Directory may already be gone
    }
  }
}

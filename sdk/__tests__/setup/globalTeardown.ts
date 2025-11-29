import { rmSync } from "fs";

export async function teardown() {
  const pid = (globalThis as any).__VALIDATOR_PID__;
  const ledgerDir = (globalThis as any).__VALIDATOR_LEDGER__;

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

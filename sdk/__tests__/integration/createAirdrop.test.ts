import { describe, it, expect, beforeAll } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { createAirdrop } from "../../src/core/createAirdrop";
import { TestContext, PROGRAM_ID } from "../fixtures/testContext";
import {
  generateAirdropJson,
  merkleRootToBytes,
} from "../fixtures/cliHelpers";

describe("createAirdrop integration", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = new TestContext(3);
    ctx.setAmounts([100, 200, 300]);
    await ctx.fundAuthority(10);
  });

  it("creates an airdrop on-chain", async () => {
    const program = ctx.getAuthorityProgram();

    // Generate airdrop JSON using CLI
    const airdropJson = generateAirdropJson(
      ctx.claimants.map((c) => ({ address: c.address, amount: c.amount }))
    );

    const merkleRootHash = merkleRootToBytes(airdropJson.merkle_root);
    const totalAmount = ctx.claimants.reduce((sum, c) => sum + c.amount, 0);

    const result = await createAirdrop({
      connection: ctx.connection,
      signer: ctx.getAuthoritySigner(),
      program,
      merkleRootHash,
      amount: totalAmount,
    });

    expect(result.signature).toBeDefined();
    expect(result.signature.length).toBeGreaterThan(0);
    expect(result.mint).toBeInstanceOf(PublicKey);

    // Verify on-chain state
    const merkleRootPda = PublicKey.findProgramAddressSync(
      [Buffer.from("merkle_root"), Buffer.from(merkleRootHash)],
      new PublicKey(PROGRAM_ID)
    )[0];

    const merkleRootAccount = await program.account.merkleRoot.fetch(
      merkleRootPda
    );
    expect(merkleRootAccount.mint.toBase58()).toBe(result.mint.toBase58());

    // Verify the hash stored matches what we sent
    const storedHash = Array.from(merkleRootAccount.hash);
    expect(storedHash).toEqual(merkleRootHash);
  });

  it("creates multiple airdrops with different merkle roots", async () => {
    const program = ctx.getAuthorityProgram();

    // Create first airdrop
    const ctx1 = new TestContext(2);
    ctx1.setAmounts([500, 500]);
    const airdropJson1 = generateAirdropJson(
      ctx1.claimants.map((c) => ({ address: c.address, amount: c.amount }))
    );
    const merkleRootHash1 = merkleRootToBytes(airdropJson1.merkle_root);

    const result1 = await createAirdrop({
      connection: ctx.connection,
      signer: ctx.getAuthoritySigner(),
      program,
      merkleRootHash: merkleRootHash1,
      amount: 1000,
    });

    // Create second airdrop with different claimants
    const ctx2 = new TestContext(2);
    ctx2.setAmounts([750, 250]);
    const airdropJson2 = generateAirdropJson(
      ctx2.claimants.map((c) => ({ address: c.address, amount: c.amount }))
    );
    const merkleRootHash2 = merkleRootToBytes(airdropJson2.merkle_root);

    const result2 = await createAirdrop({
      connection: ctx.connection,
      signer: ctx.getAuthoritySigner(),
      program,
      merkleRootHash: merkleRootHash2,
      amount: 1000,
    });

    // Both should succeed with different mints
    expect(result1.mint.toBase58()).not.toBe(result2.mint.toBase58());
    expect(merkleRootHash1).not.toEqual(merkleRootHash2);
  });
});

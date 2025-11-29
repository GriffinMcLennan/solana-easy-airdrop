import { describe, it, expect, beforeAll } from "vitest";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { createAirdrop } from "../../src/core/createAirdrop";
import { claimAirdrop } from "../../src/core/claimAirdrop";
import { TestContext, keypairToSigner } from "../fixtures/testContext";
import {
  generateAirdropJson,
  merkleRootToBytes,
  getClaimDataFromJson,
} from "../fixtures/cliHelpers";

describe("E2E: Full airdrop flow", () => {
  it("creates airdrop and all claimants claim successfully", async () => {
    // Setup: 3 claimants with different amounts
    const ctx = new TestContext(3);
    ctx.setAmounts([100, 250, 650]);
    await ctx.fundAuthority(10);
    await ctx.fundClaimants(1);

    const totalAmount = ctx.claimants.reduce((sum, c) => sum + c.amount, 0);

    // Generate airdrop JSON
    const airdropJson = generateAirdropJson(
      ctx.claimants.map((c) => ({ address: c.address, amount: c.amount }))
    );
    const merkleRootHash = merkleRootToBytes(airdropJson.merkle_root);

    // Create airdrop
    const program = ctx.getAuthorityProgram();
    const createResult = await createAirdrop({
      connection: ctx.connection,
      signer: ctx.getAuthoritySigner(),
      program,
      merkleRootHash,
      amount: totalAmount,
    });

    expect(createResult.signature).toBeDefined();
    expect(createResult.mint).toBeDefined();

    const mint = createResult.mint;

    // Each claimant claims
    for (let i = 0; i < ctx.claimants.length; i++) {
      const claimant = ctx.claimants[i];
      const claimData = getClaimDataFromJson(airdropJson, claimant.address);
      const claimantProgram = ctx.getClaimantProgram(i);

      const claimResult = await claimAirdrop({
        connection: ctx.connection,
        signer: keypairToSigner(claimant.keypair),
        program: claimantProgram,
        merkleRootHash,
        claimData,
      });

      expect(claimResult.signature).toBeDefined();
      expect(claimResult.amount).toBe(claimant.amount.toString());

      // Verify token balance
      const ata = getAssociatedTokenAddressSync(
        mint,
        claimant.keypair.publicKey
      );
      const balance = await ctx.connection.getTokenAccountBalance(ata);
      expect(balance.value.amount).toBe(claimant.amount.toString());
    }
  });

  it("handles airdrop with many claimants", async () => {
    const numClaimants = 10;
    const ctx = new TestContext(numClaimants);

    // Generate random amounts that sum to a known total
    const amounts = Array.from({ length: numClaimants }, (_, i) => (i + 1) * 50);
    ctx.setAmounts(amounts);

    await ctx.fundAuthority(10);
    await ctx.fundClaimants(1);

    const totalAmount = amounts.reduce((sum, a) => sum + a, 0);

    const airdropJson = generateAirdropJson(
      ctx.claimants.map((c) => ({ address: c.address, amount: c.amount }))
    );
    const merkleRootHash = merkleRootToBytes(airdropJson.merkle_root);

    const program = ctx.getAuthorityProgram();
    const createResult = await createAirdrop({
      connection: ctx.connection,
      signer: ctx.getAuthoritySigner(),
      program,
      merkleRootHash,
      amount: totalAmount,
    });

    expect(createResult.signature).toBeDefined();

    // Claim for first, middle, and last claimant
    const indicesToClaim = [0, Math.floor(numClaimants / 2), numClaimants - 1];

    for (const i of indicesToClaim) {
      const claimant = ctx.claimants[i];
      const claimData = getClaimDataFromJson(airdropJson, claimant.address);
      const claimantProgram = ctx.getClaimantProgram(i);

      const claimResult = await claimAirdrop({
        connection: ctx.connection,
        signer: keypairToSigner(claimant.keypair),
        program: claimantProgram,
        merkleRootHash,
        claimData,
      });

      expect(claimResult.amount).toBe(claimant.amount.toString());
    }
  });
});

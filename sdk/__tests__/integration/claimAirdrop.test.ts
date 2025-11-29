import { describe, it, expect, beforeAll } from "vitest";
import { createAirdrop } from "../../src/core/createAirdrop";
import { claimAirdrop } from "../../src/core/claimAirdrop";
import { TestContext, keypairToSigner } from "../fixtures/testContext";
import {
  generateAirdropJson,
  merkleRootToBytes,
  getClaimDataFromJson,
  type AirdropJson,
} from "../fixtures/cliHelpers";

describe("claimAirdrop integration", () => {
  let ctx: TestContext;
  let airdropJson: AirdropJson;
  let merkleRootHash: number[];

  beforeAll(async () => {
    ctx = new TestContext(2);
    ctx.setAmounts([1000, 2000]);
    await ctx.fundAuthority(10);
    await ctx.fundClaimants(1);

    // Generate and deploy airdrop
    airdropJson = generateAirdropJson(
      ctx.claimants.map((c) => ({ address: c.address, amount: c.amount }))
    );

    merkleRootHash = merkleRootToBytes(airdropJson.merkle_root);

    const program = ctx.getAuthorityProgram();
    const totalAmount = ctx.claimants.reduce((sum, c) => sum + c.amount, 0);

    await createAirdrop({
      connection: ctx.connection,
      signer: ctx.getAuthoritySigner(),
      program,
      merkleRootHash,
      amount: totalAmount,
    });
  });

  it("claims airdrop successfully", async () => {
    const claimant = ctx.claimants[0];

    // Get claim data from the JSON (direct injection, no server)
    const claimData = getClaimDataFromJson(airdropJson, claimant.address);

    const claimantProgram = ctx.getClaimantProgram(0);

    const result = await claimAirdrop({
      connection: ctx.connection,
      signer: keypairToSigner(claimant.keypair),
      program: claimantProgram,
      merkleRootHash,
      claimData,
    });

    expect(result.signature).toBeDefined();
    expect(result.signature.length).toBeGreaterThan(0);
    expect(result.amount).toBe(claimant.amount.toString());
  });

  it("prevents double claiming", async () => {
    const claimant = ctx.claimants[0]; // Already claimed in previous test

    const claimData = getClaimDataFromJson(airdropJson, claimant.address);

    const claimantProgram = ctx.getClaimantProgram(0);

    await expect(
      claimAirdrop({
        connection: ctx.connection,
        signer: keypairToSigner(claimant.keypair),
        program: claimantProgram,
        merkleRootHash,
        claimData,
      })
    ).rejects.toThrow();
  });

  it("allows second claimant to claim", async () => {
    const claimant = ctx.claimants[1];

    const claimData = getClaimDataFromJson(airdropJson, claimant.address);

    const claimantProgram = ctx.getClaimantProgram(1);

    const result = await claimAirdrop({
      connection: ctx.connection,
      signer: keypairToSigner(claimant.keypair),
      program: claimantProgram,
      merkleRootHash,
      claimData,
    });

    expect(result.signature).toBeDefined();
    expect(result.amount).toBe(claimant.amount.toString());
  });
});

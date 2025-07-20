import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AirdropContract } from "../../target/types/airdrop_contract";
import { createMintAndFundCreator } from "../utils/createMintAndFundCreator";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { kp1, kp2, kp3, kp4 } from './keypairs';

const MERKLE_ROOT = [211,87,117,29,252,61,251,86,136,154,43,103,216,37,244,153,107,154,23,148,111,246,101,12,102,166,26,186,249,210,117,10];

describe("airdrop-contract", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.airdropContract as Program<AirdropContract>;
  const authority = anchor.web3.Keypair.generate();
  const connection = anchor.getProvider().connection;
  let mint: anchor.web3.PublicKey, creatorTokenAccount: anchor.web3.PublicKey;

  it("Create airdrop!", async () => {
    const airdropSignature = await connection.requestAirdrop(authority.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSignature);
    ({ mint, creatorTokenAccount } = await createMintAndFundCreator(connection, authority));

    try {
      const tx = await program.methods.createAirdrop(MERKLE_ROOT, new anchor.BN(10_000 * (10 ** 6))).accounts({
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        mint
      }).signers([authority]).rpc();
      console.log("Your transaction signature", tx);
    }
    catch (e) {
      console.log(e);
      console.log(e.getLogs());
    }
  });

  it("Claim airdrop", async () => {
    try {
      const airdropSignature = await connection.requestAirdrop(kp1.publicKey, anchor.web3.LAMPORTS_PER_SOL);
      await connection.confirmTransaction(airdropSignature);

      const merkleRoot = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("merkle_root"), Buffer.from(MERKLE_ROOT)], program.programId)[0];

      const tx = await program.methods.claim([[]], new anchor.BN(10)).accounts({
        authority: kp1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        mint,
      }).signers([kp1]).rpc();
      console.log("Your transaction signature", tx);
    }
    catch (e) {
      console.log(e);
      console.log(e.getLogs());
    }
  });
});



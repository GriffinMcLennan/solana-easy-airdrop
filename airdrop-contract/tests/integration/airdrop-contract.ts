import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AirdropContract } from "../../target/types/airdrop_contract";
import { createMintAndFundCreator } from "../utils/createMintAndFundCreator";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("airdrop-contract", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.airdropContract as Program<AirdropContract>;
  const authority = anchor.web3.Keypair.generate();


  it("Create airdrop!", async () => {
    const connection = anchor.getProvider().connection;
    const airdropSignature = await connection.requestAirdrop(authority.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSignature);

    const { mint, creatorTokenAccount } = await createMintAndFundCreator(connection, authority);

    try {
      const tx = await program.methods.createAirdrop(new Array(32).fill(0), new anchor.BN(10_000 * (10 ** 6))).accounts({
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
  })
});



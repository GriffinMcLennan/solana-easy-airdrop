import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AirdropContract } from "../../target/types/airdrop_contract";
import { createMintAndFundCreator } from "../utils/createMintAndFundCreator";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { kp1, kp2, kp3, kp4 } from './keypairs';
import { MERKLE_ROOT, PROOF1 } from "./constants";


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
    const airdropSignature = await connection.requestAirdrop(kp2.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSignature);

    const merkleRoot = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("merkle_root"), Buffer.from(MERKLE_ROOT)], program.programId)[0];
    console.log("Signer:", kp2.publicKey.toString());

    const tx = await program.methods.claim(PROOF1, new anchor.BN(20), 5).accounts({
      authority: kp2.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      mint,
      merkleRoot,
    }).signers([kp2]).rpc();
    console.log("Your transaction signature", tx);

    const kp2TokenAccount = await getAssociatedTokenAddress(mint, kp2.publicKey, undefined, TOKEN_PROGRAM_ID, undefined);
    const balance = await connection.getTokenAccountBalance(kp2TokenAccount);
    console.log("Balance:", balance.value.amount);
  });

  it("Second claim attempt fails", async () => {
    const airdropSignature = await connection.requestAirdrop(kp2.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSignature);

    const merkleRoot = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("merkle_root"), Buffer.from(MERKLE_ROOT)], program.programId)[0];
    console.log("Signer:", kp2.publicKey.toString());

    try {
      await program.methods.claim(PROOF1, new anchor.BN(20), 5).accounts({
        authority: kp2.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        mint,
        merkleRoot,
      }).signers([kp2]).rpc();
    }
    catch (e) {
      console.log(e.message);
    }
  });

  // TODO: claim other leaves of tree
});



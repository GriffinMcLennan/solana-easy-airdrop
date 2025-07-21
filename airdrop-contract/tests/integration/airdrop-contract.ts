import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AirdropContract } from "../../target/types/airdrop_contract";
import { createMintAndFundCreator } from "../utils/createMintAndFundCreator";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { kp1, kp2, kp3, kp4 } from './keypairs';

const MERKLE_ROOT = [
  183,
  212,
  55,
  110,
  204,
  126,
  97,
  153,
  216,
  200,
  30,
  51,
  98,
  40,
  190,
  225,
  107,
  43,
  226,
  57,
  247,
  238,
  124,
  136,
  102,
  169,
  76,
  172,
  106,
  165,
  138,
  171
];
const PROOF1 = [
  [
    184,
    174,
    33,
    251,
    237,
    137,
    135,
    48,
    251,
    254,
    31,
    70,
    78,
    111,
    250,
    90,
    78,
    219,
    144,
    127,
    166,
    134,
    31,
    99,
    251,
    160,
    11,
    18,
    230,
    236,
    101,
    93
  ],
  [
    172,
    183,
    243,
    33,
    134,
    40,
    254,
    104,
    74,
    153,
    88,
    219,
    4,
    31,
    177,
    3,
    69,
    238,
    137,
    110,
    221,
    167,
    50,
    200,
    86,
    125,
    242,
    40,
    28,
    183,
    166,
    68
  ]
];

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
    }
    catch (e) {
      console.log(e);
      console.log(e.getLogs());
    }
  });
});



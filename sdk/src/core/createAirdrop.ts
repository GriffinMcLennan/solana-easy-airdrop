import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { type Program, BN } from "@coral-xyz/anchor";
import type { AirdropContract } from "../types";

const MINT_DECIMALS = 6;
const TEN_THOUSAND_TOKENS = 10_000 * 10 ** MINT_DECIMALS;

/**
 * A signer interface compatible with both AnchorWallet and Keypair-based signers
 */
export interface Signer {
  publicKey: PublicKey;
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>;
}

export interface CreateAirdropParams {
  connection: Connection;
  signer: Signer;
  program: Program<AirdropContract>;
  merkleRootHash: number[];
  amount: number;
}

export interface CreateAirdropResult {
  signature: string;
  mint: PublicKey;
}

/**
 * Create an airdrop by:
 * 1. Creating a new mint
 * 2. Creating the authority's associated token account
 * 3. Minting tokens to the authority
 * 4. Creating the on-chain merkle root account
 */
export async function createAirdrop(
  params: CreateAirdropParams
): Promise<CreateAirdropResult> {
  const { connection, signer, program, merkleRootHash, amount } = params;

  // Generate keypair to use as address of mint
  const mint = Keypair.generate();

  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: signer.publicKey,
    newAccountPubkey: mint.publicKey,
    space: MINT_SIZE,
    lamports: await getMinimumBalanceForRentExemptMint(connection),
    programId: TOKEN_PROGRAM_ID,
  });

  const initializeMintInstruction = createInitializeMintInstruction(
    mint.publicKey,
    MINT_DECIMALS,
    signer.publicKey,
    signer.publicKey,
    TOKEN_PROGRAM_ID
  );

  const signerATA = getAssociatedTokenAddressSync(
    mint.publicKey,
    signer.publicKey
  );

  const createSignerATAInstruction = createAssociatedTokenAccountInstruction(
    signer.publicKey,
    signerATA,
    signer.publicKey,
    mint.publicKey,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const mintToAtaInstruction = createMintToInstruction(
    mint.publicKey,
    signerATA,
    signer.publicKey,
    TEN_THOUSAND_TOKENS,
    undefined,
    TOKEN_PROGRAM_ID
  );

  const createMerkleTree = await program.methods
    .createAirdrop(merkleRootHash, new BN(amount))
    .accounts({
      mint: mint.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      authority: signer.publicKey,
    })
    .instruction();

  const transaction = new Transaction().add(
    createAccountInstruction,
    initializeMintInstruction,
    createSignerATAInstruction,
    mintToAtaInstruction,
    createMerkleTree
  );

  const blockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash.blockhash;
  transaction.feePayer = signer.publicKey;
  transaction.partialSign(mint);
  const signedTx = await signer.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());

  await connection.confirmTransaction(signature);

  return { signature, mint: mint.publicKey };
}

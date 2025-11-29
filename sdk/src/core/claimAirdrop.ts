import { BN, type Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { AirdropContract, ClaimResponse } from "../types";
import { hexToBytes, numberArrayToHex } from "./utils";
import type { Signer } from "./createAirdrop";

export interface ClaimAirdropParams {
  connection: Connection;
  signer: Signer;
  program: Program<AirdropContract>;
  merkleRootHash: number[];
  claimData: ClaimResponse;
}

export interface ClaimAirdropResult {
  signature: string;
  amount: string;
}

/**
 * Fetch claim data from the airdrop server
 */
export async function fetchClaimData(
  serverUrl: string,
  rootHex: string,
  address: string
): Promise<ClaimResponse> {
  const response = await fetch(`${serverUrl}/api/airdrop/${rootHex}/${address}`);

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  const data = (await response.json()) as ClaimResponse;
  return data;
}

/**
 * Claim airdrop tokens using a merkle proof
 */
export async function claimAirdrop(
  params: ClaimAirdropParams
): Promise<ClaimAirdropResult> {
  const { connection, signer, program, merkleRootHash, claimData } = params;
  const { claim, proof } = claimData;

  const merkleRoot = PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode("merkle_root"),
      new Uint8Array(merkleRootHash),
    ],
    program.programId
  )[0];

  const merkleRootData = await program.account.merkleRoot.fetch(merkleRoot);
  const mint = merkleRootData.mint;

  // Convert hex string proofs to byte arrays for Anchor
  const proofBytes = proof.map(hexToBytes);

  const claimIx = await program.methods
    .claim(proofBytes, new BN(claim.amount), claim.leaf_index)
    .accounts({
      merkleRoot,
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      authority: signer.publicKey,
    })
    .instruction();

  const transaction = new Transaction().add(claimIx);

  const blockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash.blockhash;
  transaction.feePayer = signer.publicKey;

  const signedTx = await signer.signTransaction(transaction);

  const signature = await connection.sendRawTransaction(signedTx.serialize());

  await connection.confirmTransaction(signature);

  return { signature, amount: claim.amount };
}

// Re-export utility for convenience
export { numberArrayToHex, hexToBytes } from "./utils";

import { BN } from "@coral-xyz/anchor";
import { useAirdropProgram } from "./useAirdropProgram";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useCallback } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { ClaimResponse, UseClaimAirdropOptions } from "./types";

async function getUserClaimAndProof(
  serverUrl: string,
  rootHex: string,
  address: string
) {
  const response = await fetch(
    `${serverUrl}/api/airdrop/${rootHex}/${address}`
  );

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  const data = (await response.json()) as ClaimResponse;
  return data;
}

export function useClaimAirdrop(options: UseClaimAirdropOptions) {
  const { serverUrl } = options;
  const { program } = useAirdropProgram();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  // Helper function to convert number array to hex string
  const numberArrayToHex = (arr: number[]): string => {
    return arr.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  // Helper function to convert hex string to byte array
  const hexToBytes = (hex: string): number[] => {
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return bytes;
  };

  const claimAirdrop = useCallback(
    async (merkleRootHash: number[]) => {
      if (!program || !wallet) {
        throw new Error("Program or wallet not initialized");
      }

      const rootHex = numberArrayToHex(merkleRootHash);
      const address = wallet.publicKey?.toString();

      if (!address) {
        throw new Error("Wallet address not available");
      }

      const { claim, proof } = await getUserClaimAndProof(
        serverUrl,
        rootHex,
        address
      );
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
          authority: wallet.publicKey,
        })
        .instruction();

      const transaction = new Transaction().add(claimIx);

      const blockhash = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash.blockhash;
      transaction.feePayer = wallet.publicKey;

      const signedTx = await wallet.signTransaction(transaction);

      const signature = await connection.sendRawTransaction(
        signedTx.serialize()
      );

      await connection.confirmTransaction(signature);

      return { signature, amount: claim.amount };
    },
    [program, wallet, connection, serverUrl]
  );

  return claimAirdrop;
}

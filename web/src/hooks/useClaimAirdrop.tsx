import { BN } from "@coral-xyz/anchor";
import { useAirdropProgram } from "./useAirdropProgram";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useCallback } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, AccountLayout } from "@solana/spl-token";

interface ClaimEntry {
  amount: string;
  leaf_index: number;
}

type Proof = number[][];

interface ClaimResponse {
  claim: ClaimEntry;
  proof: Proof;
}

async function getUserClaimAndProof(rootHex: string, address: string) {
  const response = await fetch(
    `http://localhost:5000/api/airdrop/${rootHex}/${address}`
  );

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  const data = (await response.json()) as ClaimResponse;
  return data;
}

export function useClaimAirdrop() {
  const { program } = useAirdropProgram();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  // Helper function to convert number array to hex string
  const numberArrayToHex = (arr: number[]): string => {
    return arr.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  const claimAirdrop = useCallback(
    async (merkleRootHash: number[]) => {
      if (!program || !wallet) {
        throw new Error("Program or wallet not initialized");
      }

      // Convert merkleRootHash to hex string
      const rootHex = numberArrayToHex(merkleRootHash);
      const address = wallet.publicKey?.toString();

      if (!address) {
        throw new Error("Wallet address not available");
      }

      const { claim, proof } = await getUserClaimAndProof(rootHex, address);
      const merkleRoot = PublicKey.findProgramAddressSync(
        [Buffer.from("merkle_root"), Buffer.from(merkleRootHash)],
        program.programId
      )[0];

      // Find token accounts owned by the merkle root to determine the mint
      const tokenAccounts = await connection.getTokenAccountsByOwner(
        merkleRoot,
        {
          programId: TOKEN_PROGRAM_ID,
        }
      );

      if (tokenAccounts.value.length === 0) {
        throw new Error("No token accounts found for this merkle root");
      }

      // Get the mint from the first (and should be only) token account
      const tokenAccountInfo = tokenAccounts.value[0];
      const tokenAccountData = AccountLayout.decode(
        tokenAccountInfo.account.data
      );
      const mint = new PublicKey(tokenAccountData.mint);

      const claimIx = await program.methods
        .claim(proof, new BN(claim.amount), claim.leaf_index)
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
      console.log("SIGNATURE:", signature);

      await connection.confirmTransaction(signature);
    },
    [program, wallet, connection]
  );

  return claimAirdrop;
}

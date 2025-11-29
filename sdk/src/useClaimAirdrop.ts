import { useAirdropProgram } from "./useAirdropProgram";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useCallback } from "react";
import type { UseClaimAirdropOptions } from "./types";
import { claimAirdrop, fetchClaimData, numberArrayToHex } from "./core";

export function useClaimAirdrop(options: UseClaimAirdropOptions) {
  const { serverUrl } = options;
  const { program } = useAirdropProgram();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  const claim = useCallback(
    async (merkleRootHash: number[]) => {
      if (!program || !wallet) {
        throw new Error("Program or wallet not initialized");
      }

      const rootHex = numberArrayToHex(merkleRootHash);
      const address = wallet.publicKey?.toString();

      if (!address) {
        throw new Error("Wallet address not available");
      }

      const claimData = await fetchClaimData(serverUrl, rootHex, address);

      return await claimAirdrop({
        connection,
        signer: wallet,
        program,
        merkleRootHash,
        claimData,
      });
    },
    [program, wallet, connection, serverUrl]
  );

  return claim;
}

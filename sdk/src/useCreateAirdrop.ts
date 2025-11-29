import { useAirdropProgram } from "./useAirdropProgram";
import { useCallback } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { createAirdrop } from "./core";

export function useCreateAirdrop() {
  const { program } = useAirdropProgram();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  const create = useCallback(
    async (merkleRootHash: number[], amount: number) => {
      if (!program || !wallet) {
        throw new Error("Program or wallet not initialized");
      }

      return await createAirdrop({
        connection,
        signer: wallet,
        program,
        merkleRootHash,
        amount,
      });
    },
    [program, wallet, connection]
  );

  return create;
}

import React, { useMemo, type ReactNode } from "react";
import { Program, AnchorProvider, type Idl } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import idl from "./idl.json";
import type { AirdropContract } from "./types";
import {
  AirdropProgramContext,
  type AirdropProgramContextType,
} from "./AirdropProgramContext";

interface AirdropProgramProviderProps {
  children: ReactNode;
}

export const AirdropProgramProvider: React.FC<AirdropProgramProviderProps> = ({
  children,
}) => {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const { program, isLoading } = useMemo(() => {
    if (!wallet || !wallet.publicKey) {
      return { program: null, isLoading: false };
    }

    try {
      const provider = new AnchorProvider(
        connection,
        wallet,
        AnchorProvider.defaultOptions()
      );

      const program = new Program(
        idl as Idl,
        provider
      ) as Program<AirdropContract>;

      return { program, isLoading: false };
    } catch (error) {
      console.error("Failed to initialize airdrop program:", error);
      return { program: null, isLoading: false };
    }
  }, [connection, wallet]);

  const value: AirdropProgramContextType = {
    program,
    isLoading,
  };

  return (
    <AirdropProgramContext.Provider value={value}>
      {children}
    </AirdropProgramContext.Provider>
  );
};

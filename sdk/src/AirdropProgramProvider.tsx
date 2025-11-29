import React, { useMemo, type ReactNode } from "react";
import { Program, AnchorProvider, type Idl } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import idl from "./idl.json";
import type { AirdropContract } from "./types";
import {
  AirdropProgramContext,
  type AirdropProgramContextType,
} from "./AirdropProgramContext";

export interface AirdropProgramProviderProps {
  children: ReactNode;
  /** Optional program ID to override the default. Use this if you've deployed your own instance of the contract. */
  programId?: PublicKey | string;
}

export const AirdropProgramProvider: React.FC<AirdropProgramProviderProps> = ({
  children,
  programId,
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

      // Override the IDL address if a custom programId is provided
      const programIdStr = programId
        ? programId instanceof PublicKey
          ? programId.toString()
          : programId
        : undefined;

      const effectiveIdl = programIdStr
        ? { ...idl, address: programIdStr }
        : idl;

      const program = new Program(
        effectiveIdl as Idl,
        provider
      ) as Program<AirdropContract>;

      return { program, isLoading: false };
    } catch (error) {
      console.error("Failed to initialize airdrop program:", error);
      return { program: null, isLoading: false };
    }
  }, [connection, wallet, programId]);

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

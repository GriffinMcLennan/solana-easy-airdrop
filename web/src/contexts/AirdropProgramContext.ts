import { createContext } from "react";
import type { Program } from "@coral-xyz/anchor";
import type { AirdropContract } from "../providers/AirdropContractTypes";

export interface AirdropProgramContextType {
  program: Program<AirdropContract> | null;
  isLoading: boolean;
}

export const AirdropProgramContext = createContext<
  AirdropProgramContextType | undefined
>(undefined);

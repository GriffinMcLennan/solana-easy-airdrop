import { useContext } from "react";
import {
  AirdropProgramContext,
  type AirdropProgramContextType,
} from "../contexts/AirdropProgramContext";

export const useAirdropProgram = (): AirdropProgramContextType => {
  const context = useContext(AirdropProgramContext);

  if (context === undefined) {
    throw new Error(
      "useAirdropProgram must be used within an AirdropProgramProvider"
    );
  }

  return context;
};

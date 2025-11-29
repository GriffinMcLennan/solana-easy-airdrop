// Provider
export {
  AirdropProgramProvider,
  type AirdropProgramProviderProps,
} from "./AirdropProgramProvider";

// Context
export {
  AirdropProgramContext,
  type AirdropProgramContextType,
} from "./AirdropProgramContext";

// Hooks
export { useAirdropProgram } from "./useAirdropProgram";
export { useCreateAirdrop } from "./useCreateAirdrop";
export { useClaimAirdrop } from "./useClaimAirdrop";

// Types
export type {
  AirdropContract,
  ClaimEntry,
  ClaimResponse,
  Proof,
  UseClaimAirdropOptions,
} from "./types";

// Core functions (for non-React usage)
export {
  createAirdrop,
  claimAirdrop,
  fetchClaimData,
  numberArrayToHex,
  hexToBytes,
  type CreateAirdropParams,
  type CreateAirdropResult,
  type ClaimAirdropParams,
  type ClaimAirdropResult,
  type Signer,
} from "./core";

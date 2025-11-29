import {
  Keypair,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import type { AirdropContract, Signer } from "../../src";
import idl from "../../src/idl.json";

export const PROGRAM_ID = "F6fHBUyYyaW14CxjSnJjLck8vMmWew3PbCnt5TMqRdZX";
export const RPC_URL = "http://localhost:8899";

export interface TestClaimant {
  keypair: Keypair;
  address: string;
  amount: number;
}

/**
 * Adapter to make a Keypair work like a Signer interface
 */
export function keypairToSigner(keypair: Keypair): Signer {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async <T extends Transaction>(tx: T): Promise<T> => {
      tx.partialSign(keypair);
      return tx;
    },
  };
}

/**
 * Create a Program instance for testing
 */
export function createTestProgram(
  connection: Connection,
  signer: Signer
): Program<AirdropContract> {
  const provider = new AnchorProvider(
    connection,
    signer as any,
    { commitment: "confirmed" }
  );

  return new Program(
    { ...idl, address: PROGRAM_ID } as any,
    provider
  ) as Program<AirdropContract>;
}

/**
 * Test context that manages keypairs and connections for tests
 */
export class TestContext {
  public connection: Connection;
  public authority: Keypair;
  public claimants: TestClaimant[];

  constructor(numClaimants: number = 0) {
    this.connection = new Connection(RPC_URL, "confirmed");
    this.authority = Keypair.generate();
    this.claimants = [];

    for (let i = 0; i < numClaimants; i++) {
      const keypair = Keypair.generate();
      this.claimants.push({
        keypair,
        address: keypair.publicKey.toBase58(),
        amount: 0,
      });
    }
  }

  /**
   * Set amounts for each claimant
   */
  setAmounts(amounts: number[]): void {
    if (amounts.length !== this.claimants.length) {
      throw new Error("Amounts length must match claimants length");
    }
    this.claimants.forEach((c, i) => (c.amount = amounts[i]));
  }

  /**
   * Fund the authority account with SOL
   */
  async fundAuthority(solAmount: number = 10): Promise<void> {
    const sig = await this.connection.requestAirdrop(
      this.authority.publicKey,
      solAmount * LAMPORTS_PER_SOL
    );
    await this.connection.confirmTransaction(sig, "confirmed");
  }

  /**
   * Fund all claimant accounts with SOL
   */
  async fundClaimants(solAmount: number = 1): Promise<void> {
    for (const claimant of this.claimants) {
      const sig = await this.connection.requestAirdrop(
        claimant.keypair.publicKey,
        solAmount * LAMPORTS_PER_SOL
      );
      await this.connection.confirmTransaction(sig, "confirmed");
    }
  }

  /**
   * Get a signer adapter for the authority
   */
  getAuthoritySigner(): Signer {
    return keypairToSigner(this.authority);
  }

  /**
   * Get a program instance using the authority
   */
  getAuthorityProgram(): Program<AirdropContract> {
    return createTestProgram(this.connection, this.getAuthoritySigner());
  }

  /**
   * Get a program instance for a specific claimant
   */
  getClaimantProgram(index: number): Program<AirdropContract> {
    const claimant = this.claimants[index];
    if (!claimant) {
      throw new Error(`Claimant at index ${index} not found`);
    }
    return createTestProgram(
      this.connection,
      keypairToSigner(claimant.keypair)
    );
  }
}

import { useAirdropProgram } from "../providers/AirdropProgramProvider";
import { useCallback } from "react";
import { useAnchorWallet, useConnection, type AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createMintToInstruction, getAssociatedTokenAddressSync, getMinimumBalanceForRentExemptMint, MINT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { type Program, BN } from "@coral-xyz/anchor";
import type { AirdropContract } from "../providers/AirdropContractTypes";

const MINT_DECIMALS = 6;
const TEN_THOUSAND_TOKENS = 10_000 * 10 ** MINT_DECIMALS;

async function createMintAndFundCreator(
    connection: Connection,
    wallet: AnchorWallet,
    program: Program<AirdropContract>,
    merkleRootHash: number[],
    amount: number,
) {

    // Generate keypair to use as address of mint
    const mint = Keypair.generate();

    const createAccountInstruction = SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports: await getMinimumBalanceForRentExemptMint(connection),
        programId: TOKEN_PROGRAM_ID
    });

    const initializeMintInstruction = createInitializeMintInstruction(
        mint.publicKey, // mint pubkey
        MINT_DECIMALS, // decimals
        wallet.publicKey, // mint authority
        wallet.publicKey, // freeze authority
        TOKEN_PROGRAM_ID
    );



    const walletATA = getAssociatedTokenAddressSync(mint.publicKey, wallet.publicKey);

    const createWalletATAInstruction = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        walletATA,
        wallet.publicKey,
        mint.publicKey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const mintToAtaInstruction = createMintToInstruction(mint.publicKey, walletATA, wallet.publicKey, TEN_THOUSAND_TOKENS, undefined, TOKEN_PROGRAM_ID);


    console.log("DEBUG: Creating merkle tree");

    const createMerkleTree = await program.methods.createAirdrop(merkleRootHash, new BN(amount)).accounts({
        mint: mint.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        authority: wallet.publicKey,
    }).instruction();

    console.log("Created merkle tree");

    const transaction = new Transaction().add(
        createAccountInstruction,
        initializeMintInstruction,
        createWalletATAInstruction,
        mintToAtaInstruction,
        createMerkleTree
    );

    const blockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash.blockhash;
    transaction.feePayer = wallet.publicKey;
    transaction.partialSign(mint);
    const signedTx = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    console.log("SIGNATURE:", signature);

    await connection.confirmTransaction(signature);

}

export function useCreateAirdrop() {
    const { program } = useAirdropProgram();
    const wallet = useAnchorWallet();
    const { connection } = useConnection();

    const createAirdrop = useCallback(async (merkleRootHash: number[], amount: number) => {
        if (!program || !wallet) {
            throw new Error("Program or wallet not initialized");
        }

        await createMintAndFundCreator(connection, wallet, program, merkleRootHash, amount);
    }, [program, wallet, connection]);

    return createAirdrop;
}
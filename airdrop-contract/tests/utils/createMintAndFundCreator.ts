import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";

const MINT_DECIMALS = 6;
const TEN_THOUSAND_TOKENS = 10_000 * 10 ** MINT_DECIMALS;

export async function createMintAndFundCreator(connection: anchor.web3.Connection, creator: anchor.web3.Keypair) {
    const mintPublicKey = await splToken.createMint(
        connection,
        creator,           
        creator.publicKey, 
        null,              
        MINT_DECIMALS,
        undefined,         
        undefined,        
        splToken.TOKEN_PROGRAM_ID
    );

    const creatorTokenAccount = await splToken.createAssociatedTokenAccount(
        connection,
        creator,
        mintPublicKey,
        creator.publicKey
    );

    const sig = await splToken.mintTo(
        connection,
        creator,
        mintPublicKey,
        creatorTokenAccount,
        creator.publicKey,
        TEN_THOUSAND_TOKENS
    );
    await connection.confirmTransaction(sig);

    return {
        mint: mintPublicKey,
        creatorTokenAccount,
        tokenProgram: splToken.TOKEN_PROGRAM_ID
    };
}
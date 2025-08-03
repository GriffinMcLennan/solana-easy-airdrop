use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct MerkleRoot {
    pub hash: [u8; 32],
    pub bump: u8,
    pub mint: Pubkey,
}

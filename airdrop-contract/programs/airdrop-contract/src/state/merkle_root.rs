use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct MerkleRoot {
    pub hash: [u8; 32],
}

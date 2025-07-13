use anchor_lang::prelude::*;

#[account]
pub struct MerkleRoot {
    pub hash: [u8; 32],
}

impl MerkleRoot {
    pub const LEN: usize = 8 + 32;
}

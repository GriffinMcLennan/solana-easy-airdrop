pub mod merkle_root;
pub use merkle_root::*;
use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Config {
    // Example authority field. Expand later.
    pub authority: Pubkey,
}

impl Config {
    pub const LEN: usize = 32; // adjust when fields added
}

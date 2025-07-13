use anchor_lang::prelude::*;

declare_id!("F6fHBUyYyaW14CxjSnJjLck8vMmWew3PbCnt5TMqRdZX");

// Module organization
pub mod instructions;
pub mod state;
pub mod errors;
pub mod constants;

#[program]
pub mod airdrop_contract {
    use super::*;
    use crate::instructions::{initialize::{self, Initialize}, create_airdrop::{self, CreateAirdrop}};

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }

    pub fn create_airdrop(ctx: Context<CreateAirdrop>, merkle_root_hash: [u8; 32], amount: u64) -> Result<()> {
        create_airdrop::handler(ctx, merkle_root_hash, amount)
    }
}

// Re-export for convenience so external crates/tests can `use airdrop_contract::instructions::*;`
pub use instructions::*;

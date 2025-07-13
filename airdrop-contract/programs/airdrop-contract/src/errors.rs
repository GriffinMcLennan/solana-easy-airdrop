use anchor_lang::prelude::*;

#[error_code]
pub enum AirdropError {
    #[msg("Invalid amount")] 
    InvalidAmount,
}

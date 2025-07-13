use anchor_lang::prelude::*;
use anchor_lang::prelude::InterfaceAccount;
use anchor_spl::{associated_token::AssociatedToken, token::{self, TransferChecked}, token_interface::{Mint, TokenAccount, TokenInterface}};
use crate::state::merkle_root::MerkleRoot;
use crate::constants::MERKLE_ROOT_SEED;

#[derive(Accounts)]
#[instruction(merkle_root_hash: [u8; 32], amount: u64)]
pub struct CreateAirdrop<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = authority,
    )]
    pub authority_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(init_if_needed, 
        payer = authority, 
        associated_token::mint = mint, 
        associated_token::authority = merkle_root,
        associated_token::token_program = token_program,
    )]
    pub merkle_root_token_account: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = 8 + MerkleRoot::INIT_SPACE,
        seeds = [MERKLE_ROOT_SEED, merkle_root_hash.as_ref()],
        bump
    )]
    pub merkle_root: Account<'info, MerkleRoot>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(
    ctx: Context<CreateAirdrop>,
    merkle_root_hash: [u8; 32],
    amount: u64,
) -> Result<()> {
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let accounts = TransferChecked {
        from: ctx.accounts.authority_token_account.to_account_info(),
        to: ctx.accounts.merkle_root_token_account.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(cpi_program, accounts);
    token::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

    let merkle_root = &mut ctx.accounts.merkle_root;
    merkle_root.hash = merkle_root_hash;
    Ok(())
}

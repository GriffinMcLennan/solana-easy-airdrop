use anchor_lang::{prelude::*, solana_program::hash::hashv};
use anchor_spl::{associated_token::AssociatedToken, token::{self, TransferChecked}, token_interface::{Mint, TokenAccount, TokenInterface}};
use crate::state::{ClaimReceipt, MerkleRoot};
use crate::constants::CLAIM_RECEIPT_SEED;
use crate::errors::AirdropError;

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = authority,
        associated_token::token_program = token_program,
    )]
    pub authority_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = merkle_root,
        associated_token::token_program = token_program,
    )]
    pub merkle_root_token_account: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub merkle_root: Account<'info, MerkleRoot>,
    #[account(
        init,
        payer = authority,
        space = 8 + ClaimReceipt::INIT_SPACE,
        seeds = [CLAIM_RECEIPT_SEED, merkle_root.key().as_ref(), authority.key().as_ref()],
        bump
    )]
    pub claim_receipt: Account<'info, ClaimReceipt>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Claim>, proof: Vec<[u8; 32]>, amount: u64, leaf_index: u32) -> Result<()> {
    let merkle_root = &ctx.accounts.merkle_root;

    let address = &ctx.accounts.authority.key().to_string();
    let mut hash = hashv(&[address.as_bytes(), &amount.to_le_bytes()]);
    let mut proof_index = leaf_index;

    for neighbor_hash in proof {
        if proof_index % 2 == 0 {
            hash = hashv(&[hash.as_ref(), neighbor_hash.as_ref()]);
        } else {
            hash = hashv(&[neighbor_hash.as_ref(), hash.as_ref()]);
        }

        proof_index /= 2;
    }

    if hash.as_ref() != merkle_root.hash {
        return Err(AirdropError::InvalidProof.into());
    }

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let accounts = TransferChecked {
        from: ctx.accounts.merkle_root_token_account.to_account_info(),
        to: ctx.accounts.authority_token_account.to_account_info(),
        authority: ctx.accounts.merkle_root.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
    };

    let seeds = &[
        crate::constants::MERKLE_ROOT_SEED,
        merkle_root.hash.as_ref(),
        &[ctx.accounts.merkle_root.bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(cpi_program, accounts, signer);
    token::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;
    
    Ok(())
}
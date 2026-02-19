use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("7aWP4zjjZpuMLLeD3EX8rjVepmoRTZ9rgh6Me9wRAnNv");

// Hardcoded resolver authority — set to your resolver wallet pubkey
pub const RESOLVER_AUTHORITY: Pubkey =
    pubkey!("B5rMQjvidT5WyzUvshACtJptVkwuFMrqGvHLQ86zwzav");

pub const USDC_MINT: Pubkey =
    pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

pub const STAKE_AMOUNT: u64 = 1_000_000; // 1 USDC (6 decimals)

#[program]
pub mod cntndr {
    use super::*;

    /// Create a new challenge PDA + vault ATA.
    pub fn init_challenge(
        ctx: Context<InitChallenge>,
        challenge_id: [u8; 16],
        maker: Pubkey,
        taker: Pubkey,
    ) -> Result<()> {
        let challenge = &mut ctx.accounts.challenge;
        challenge.challenge_id = challenge_id;
        challenge.maker = maker;
        challenge.taker = taker;
        challenge.maker_funded = false;
        challenge.taker_funded = false;
        challenge.status = ChallengeStatus::Accepted;
        challenge.bump = ctx.bumps.challenge;
        msg!("Challenge initialized: maker={}, taker={}", maker, taker);
        Ok(())
    }

    /// Player funds 1 USDC into the vault.
    pub fn fund(ctx: Context<Fund>, _challenge_id: [u8; 16]) -> Result<()> {
        let challenge = &mut ctx.accounts.challenge;
        require!(
            challenge.status == ChallengeStatus::Accepted,
            CntndrError::InvalidStatus
        );

        let player = ctx.accounts.player.key();
        let is_maker = player == challenge.maker;
        let is_taker = player == challenge.taker;
        require!(is_maker || is_taker, CntndrError::NotParticipant);

        if is_maker {
            require!(!challenge.maker_funded, CntndrError::AlreadyFunded);
        } else {
            require!(!challenge.taker_funded, CntndrError::AlreadyFunded);
        }

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player_ata.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.player.to_account_info(),
                },
            ),
            STAKE_AMOUNT,
        )?;

        if is_maker {
            challenge.maker_funded = true;
        } else {
            challenge.taker_funded = true;
        }

        if challenge.maker_funded && challenge.taker_funded {
            challenge.status = ChallengeStatus::Funded;
            msg!("Both players funded — challenge is FUNDED");
        } else {
            msg!("Player {} funded", player);
        }

        Ok(())
    }

    /// Resolver refunds vault to the single funded player.
    pub fn refund_one_sided(ctx: Context<ResolverAction>, challenge_id: [u8; 16]) -> Result<()> {
        let challenge = &ctx.accounts.challenge;
        require!(
            challenge.status == ChallengeStatus::Accepted,
            CntndrError::InvalidStatus
        );
        require!(
            challenge.maker_funded ^ challenge.taker_funded,
            CntndrError::RefundNotApplicable
        );

        let funded_player = if challenge.maker_funded {
            challenge.maker
        } else {
            challenge.taker
        };
        require!(
            ctx.accounts.recipient.key() == funded_player,
            CntndrError::WrongRecipient
        );

        let vault_balance = ctx.accounts.vault.amount;
        let bump = challenge.bump;
        // Drop immutable borrow before mutable borrow
        drop(challenge);

        let seeds: &[&[u8]] = &[b"challenge", challenge_id.as_ref(), &[bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.recipient_ata.to_account_info(),
                    authority: ctx.accounts.challenge.to_account_info(),
                },
                &[seeds],
            ),
            vault_balance,
        )?;

        ctx.accounts.challenge.status = ChallengeStatus::CancelledOrForfeit;
        msg!("Refunded {} to {}", vault_balance, funded_player);
        Ok(())
    }

    /// Resolver sends full vault to the winner.
    pub fn resolve(ctx: Context<ResolverAction>, challenge_id: [u8; 16]) -> Result<()> {
        let challenge = &ctx.accounts.challenge;
        require!(
            challenge.status == ChallengeStatus::Funded
                || challenge.status == ChallengeStatus::ProofPending,
            CntndrError::InvalidStatus
        );

        let winner = ctx.accounts.recipient.key();
        require!(
            winner == challenge.maker || winner == challenge.taker,
            CntndrError::WrongRecipient
        );

        let vault_balance = ctx.accounts.vault.amount;
        let bump = challenge.bump;
        drop(challenge);

        let seeds: &[&[u8]] = &[b"challenge", challenge_id.as_ref(), &[bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.recipient_ata.to_account_info(),
                    authority: ctx.accounts.challenge.to_account_info(),
                },
                &[seeds],
            ),
            vault_balance,
        )?;

        ctx.accounts.challenge.status = ChallengeStatus::Resolved;
        msg!("Resolved: {} wins {}", winner, vault_balance);
        Ok(())
    }

    /// Resolver sends vault to the pool ATA (dispute/forfeit).
    pub fn forfeit_to_pool(ctx: Context<ForfeitToPool>, challenge_id: [u8; 16]) -> Result<()> {
        let challenge = &ctx.accounts.challenge;
        require!(
            challenge.status == ChallengeStatus::Funded
                || challenge.status == ChallengeStatus::ProofPending,
            CntndrError::InvalidStatus
        );

        let vault_balance = ctx.accounts.vault.amount;
        let bump = challenge.bump;
        drop(challenge);

        let seeds: &[&[u8]] = &[b"challenge", challenge_id.as_ref(), &[bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.pool_ata.to_account_info(),
                    authority: ctx.accounts.challenge.to_account_info(),
                },
                &[seeds],
            ),
            vault_balance,
        )?;

        ctx.accounts.challenge.status = ChallengeStatus::CancelledOrForfeit;
        msg!("Forfeited {} to pool", vault_balance);
        Ok(())
    }
}

// ─── State ───────────────────────────────────────────────────────────────────

#[account]
pub struct Challenge {
    pub challenge_id: [u8; 16],
    pub maker: Pubkey,
    pub taker: Pubkey,
    pub maker_funded: bool,
    pub taker_funded: bool,
    pub status: ChallengeStatus,
    pub bump: u8,
}

impl Challenge {
    // 8 (discriminator) + 16 + 32 + 32 + 1 + 1 + 1 + 1 = 92
    pub const SIZE: usize = 8 + 16 + 32 + 32 + 1 + 1 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ChallengeStatus {
    Accepted,
    Funded,
    ProofPending,
    Resolved,
    CancelledOrForfeit,
}

// ─── Account Contexts ────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(challenge_id: [u8; 16])]
pub struct InitChallenge<'info> {
    #[account(
        init,
        payer = resolver,
        space = Challenge::SIZE,
        seeds = [b"challenge", challenge_id.as_ref()],
        bump,
    )]
    pub challenge: Account<'info, Challenge>,

    #[account(
        init_if_needed,
        payer = resolver,
        associated_token::mint = usdc_mint,
        associated_token::authority = challenge,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(address = USDC_MINT)]
    pub usdc_mint: Account<'info, Mint>,

    #[account(mut, address = RESOLVER_AUTHORITY)]
    pub resolver: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
#[instruction(challenge_id: [u8; 16])]
pub struct Fund<'info> {
    #[account(
        mut,
        seeds = [b"challenge", challenge_id.as_ref()],
        bump = challenge.bump,
    )]
    pub challenge: Account<'info, Challenge>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = challenge,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(address = USDC_MINT)]
    pub usdc_mint: Account<'info, Mint>,

    pub player: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = player,
    )]
    pub player_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(challenge_id: [u8; 16])]
pub struct ResolverAction<'info> {
    #[account(
        mut,
        seeds = [b"challenge", challenge_id.as_ref()],
        bump = challenge.bump,
    )]
    pub challenge: Account<'info, Challenge>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = challenge,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(address = USDC_MINT)]
    pub usdc_mint: Account<'info, Mint>,

    #[account(mut, address = RESOLVER_AUTHORITY)]
    pub resolver: Signer<'info>,

    /// CHECK: validated in instruction logic
    pub recipient: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = resolver,
        associated_token::mint = usdc_mint,
        associated_token::authority = recipient,
    )]
    pub recipient_ata: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
#[instruction(challenge_id: [u8; 16])]
pub struct ForfeitToPool<'info> {
    #[account(
        mut,
        seeds = [b"challenge", challenge_id.as_ref()],
        bump = challenge.bump,
    )]
    pub challenge: Account<'info, Challenge>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = challenge,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(address = USDC_MINT)]
    pub usdc_mint: Account<'info, Mint>,

    #[account(mut, address = RESOLVER_AUTHORITY)]
    pub resolver: Signer<'info>,

    /// CHECK: PDA derived from known seeds
    #[account(seeds = [b"pool_authority"], bump)]
    pub pool_authority: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = resolver,
        associated_token::mint = usdc_mint,
        associated_token::authority = pool_authority,
    )]
    pub pool_ata: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum CntndrError {
    #[msg("Invalid challenge status for this operation")]
    InvalidStatus,
    #[msg("Signer is not a participant in this challenge")]
    NotParticipant,
    #[msg("Player has already funded")]
    AlreadyFunded,
    #[msg("Refund not applicable — need exactly one funded player")]
    RefundNotApplicable,
    #[msg("Recipient does not match expected player")]
    WrongRecipient,
}

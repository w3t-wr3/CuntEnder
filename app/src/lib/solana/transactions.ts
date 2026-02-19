/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  PublicKey,
  SystemProgram,
  Transaction,
  Connection,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { getProgram, getResolverKeypair } from "./resolver";
import { getChallengePda, getPoolAuthorityPda, USDC_MINT } from "./program";

function idBytes(challengeId: Uint8Array): any {
  return Array.from(challengeId);
}

/**
 * Build a fund transaction for a player to sign client-side.
 */
export async function buildFundTx(
  challengeId: Uint8Array,
  playerPubkey: PublicKey,
  connection: Connection
): Promise<string> {
  const program = getProgram();
  const [challengePda] = getChallengePda(challengeId);
  const vault = getAssociatedTokenAddressSync(USDC_MINT, challengePda, true);
  const playerAta = getAssociatedTokenAddressSync(USDC_MINT, playerPubkey);

  const ix = await (program.methods as any)
    .fund(idBytes(challengeId))
    .accounts({
      challenge: challengePda,
      vault,
      usdcMint: USDC_MINT,
      player: playerPubkey,
      playerAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const tx = new Transaction().add(ix);
  tx.feePayer = playerPubkey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  return Buffer.from(tx.serialize({ requireAllSignatures: false })).toString(
    "base64"
  );
}

/**
 * Server-side: init a challenge on-chain (resolver signs).
 */
export async function initChallengeOnChain(
  challengeId: Uint8Array,
  maker: PublicKey,
  taker: PublicKey
): Promise<string> {
  const program = getProgram();
  const resolver = getResolverKeypair();
  const [challengePda] = getChallengePda(challengeId);
  const vault = getAssociatedTokenAddressSync(USDC_MINT, challengePda, true);

  const sig: string = await (program.methods as any)
    .initChallenge(idBytes(challengeId), maker, taker)
    .accounts({
      challenge: challengePda,
      vault,
      usdcMint: USDC_MINT,
      resolver: resolver.publicKey,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc();

  return sig;
}

/**
 * Server-side: resolve challenge, pay winner.
 */
export async function resolveOnChain(
  challengeId: Uint8Array,
  winnerPubkey: PublicKey
): Promise<string> {
  const program = getProgram();
  const resolver = getResolverKeypair();
  const [challengePda] = getChallengePda(challengeId);
  const vault = getAssociatedTokenAddressSync(USDC_MINT, challengePda, true);
  const recipientAta = getAssociatedTokenAddressSync(USDC_MINT, winnerPubkey);

  const sig: string = await (program.methods as any)
    .resolve(idBytes(challengeId))
    .accounts({
      challenge: challengePda,
      vault,
      usdcMint: USDC_MINT,
      resolver: resolver.publicKey,
      recipient: winnerPubkey,
      recipientAta,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc();

  return sig;
}

/**
 * Server-side: refund the single funded player.
 */
export async function refundOnChain(
  challengeId: Uint8Array,
  fundedPlayerPubkey: PublicKey
): Promise<string> {
  const program = getProgram();
  const resolver = getResolverKeypair();
  const [challengePda] = getChallengePda(challengeId);
  const vault = getAssociatedTokenAddressSync(USDC_MINT, challengePda, true);
  const recipientAta = getAssociatedTokenAddressSync(
    USDC_MINT,
    fundedPlayerPubkey
  );

  const sig: string = await (program.methods as any)
    .refundOneSided(idBytes(challengeId))
    .accounts({
      challenge: challengePda,
      vault,
      usdcMint: USDC_MINT,
      resolver: resolver.publicKey,
      recipient: fundedPlayerPubkey,
      recipientAta,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc();

  return sig;
}

/**
 * Server-side: forfeit vault to pool.
 */
export async function forfeitToPoolOnChain(
  challengeId: Uint8Array
): Promise<string> {
  const program = getProgram();
  const resolver = getResolverKeypair();
  const [challengePda] = getChallengePda(challengeId);
  const vault = getAssociatedTokenAddressSync(USDC_MINT, challengePda, true);
  const [poolAuthority] = getPoolAuthorityPda();
  const poolAta = getAssociatedTokenAddressSync(USDC_MINT, poolAuthority, true);

  const sig: string = await (program.methods as any)
    .forfeitToPool(idBytes(challengeId))
    .accounts({
      challenge: challengePda,
      vault,
      usdcMint: USDC_MINT,
      resolver: resolver.publicKey,
      poolAuthority,
      poolAta,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc();

  return sig;
}

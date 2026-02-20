/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  Connection,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { getResolverKeypair, getResolverProvider } from "./resolver";
import {
  getChallengePda,
  getPoolAuthorityPda,
  USDC_MINT,
  PROGRAM_ID,
} from "./program";

// Instruction discriminators (SHA256("global:<snake_case_name>")[:8])
const DISCRIMINATORS = {
  initChallenge: Buffer.from([24, 154, 153, 170, 71, 69, 5, 161]),
  fund: Buffer.from([218, 188, 111, 221, 152, 113, 174, 7]),
  refundOneSided: Buffer.from([13, 71, 168, 166, 180, 199, 223, 26]),
  resolve: Buffer.from([246, 150, 236, 206, 108, 63, 58, 10]),
  forfeitToPool: Buffer.from([228, 7, 76, 68, 220, 81, 252, 252]),
};

/** Serialize a challengeId arg (16 bytes) */
function serializeChallengeIdArg(challengeId: Uint8Array): Buffer {
  return Buffer.from(challengeId);
}

/** Serialize a pubkey arg (32 bytes) */
function serializePubkeyArg(pubkey: PublicKey): Buffer {
  return pubkey.toBuffer();
}

/** Helper: build instruction data from discriminator + arg buffers */
function buildData(discriminator: Buffer, ...args: Buffer[]): Buffer {
  return Buffer.concat([discriminator, ...args]);
}

/** Helper: writable account meta */
function w(pubkey: PublicKey): { pubkey: PublicKey; isSigner: boolean; isWritable: boolean } {
  return { pubkey, isSigner: false, isWritable: true };
}

/** Helper: readonly account meta */
function r(pubkey: PublicKey): { pubkey: PublicKey; isSigner: boolean; isWritable: boolean } {
  return { pubkey, isSigner: false, isWritable: false };
}

/** Helper: writable signer account meta */
function ws(pubkey: PublicKey): { pubkey: PublicKey; isSigner: boolean; isWritable: boolean } {
  return { pubkey, isSigner: true, isWritable: true };
}

/** Helper: readonly signer account meta */
function rs(pubkey: PublicKey): { pubkey: PublicKey; isSigner: boolean; isWritable: boolean } {
  return { pubkey, isSigner: true, isWritable: false };
}

function getConnection(): Connection {
  return new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    "confirmed"
  );
}

/**
 * Build a fund transaction for a player to sign client-side.
 *
 * Accounts (in order):
 *   0. challenge   [writable]
 *   1. vault       [writable]
 *   2. usdcMint    []
 *   3. player      [signer]
 *   4. playerAta   [writable]
 *   5. tokenProgram[]
 */
export async function buildFundTx(
  challengeId: Uint8Array,
  playerPubkey: PublicKey,
  connection: Connection
): Promise<string> {
  const [challengePda] = getChallengePda(challengeId);
  const vault = getAssociatedTokenAddressSync(USDC_MINT, challengePda, true);
  const playerAta = getAssociatedTokenAddressSync(USDC_MINT, playerPubkey);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      w(challengePda),
      w(vault),
      r(USDC_MINT),
      rs(playerPubkey),
      w(playerAta),
      r(TOKEN_PROGRAM_ID),
    ],
    data: buildData(DISCRIMINATORS.fund, serializeChallengeIdArg(challengeId)),
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = playerPubkey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  return Buffer.from(tx.serialize({ requireAllSignatures: false })).toString(
    "base64"
  );
}

/**
 * Server-side: init a challenge on-chain (resolver signs).
 *
 * Accounts (in order):
 *   0. challenge              [writable]
 *   1. vault                  [writable]
 *   2. usdcMint               []
 *   3. resolver               [writable, signer]
 *   4. systemProgram          []
 *   5. tokenProgram           []
 *   6. associatedTokenProgram []
 */
export async function initChallengeOnChain(
  challengeId: Uint8Array,
  maker: PublicKey,
  taker: PublicKey
): Promise<string> {
  const resolver = getResolverKeypair();
  const connection = getConnection();
  const [challengePda] = getChallengePda(challengeId);
  const vault = getAssociatedTokenAddressSync(USDC_MINT, challengePda, true);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      w(challengePda),
      w(vault),
      r(USDC_MINT),
      ws(resolver.publicKey),
      r(SystemProgram.programId),
      r(TOKEN_PROGRAM_ID),
      r(ASSOCIATED_TOKEN_PROGRAM_ID),
    ],
    data: buildData(
      DISCRIMINATORS.initChallenge,
      serializeChallengeIdArg(challengeId),
      serializePubkeyArg(maker),
      serializePubkeyArg(taker)
    ),
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = resolver.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const sig = await sendAndConfirmTransaction(connection, tx, [resolver], {
    commitment: "confirmed",
  });

  return sig;
}

/**
 * Server-side: resolve challenge, pay winner (5% fee to resolver).
 *
 * Accounts (in order — deployed binary has fee_ata not in source):
 *   0. challenge              [writable]
 *   1. vault                  [writable]
 *   2. usdcMint               []
 *   3. resolver               [writable, signer]
 *   4. recipient              []
 *   5. recipientAta           [writable, init_if_needed]
 *   6. feeAta                 [writable, init_if_needed]
 *   7. systemProgram          []
 *   8. tokenProgram           []
 *   9. associatedTokenProgram []
 */
export async function resolveOnChain(
  challengeId: Uint8Array,
  winnerPubkey: PublicKey
): Promise<string> {
  const resolver = getResolverKeypair();
  const connection = getConnection();
  const [challengePda] = getChallengePda(challengeId);
  const vault = getAssociatedTokenAddressSync(USDC_MINT, challengePda, true);
  const recipientAta = getAssociatedTokenAddressSync(USDC_MINT, winnerPubkey);
  // The deployed program takes a fee — fee_ata is the resolver's USDC ATA
  const feeAta = getAssociatedTokenAddressSync(USDC_MINT, resolver.publicKey);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      w(challengePda),
      w(vault),
      r(USDC_MINT),
      ws(resolver.publicKey),
      r(winnerPubkey),
      w(recipientAta),
      w(feeAta),
      r(SystemProgram.programId),
      r(TOKEN_PROGRAM_ID),
      r(ASSOCIATED_TOKEN_PROGRAM_ID),
    ],
    data: buildData(
      DISCRIMINATORS.resolve,
      serializeChallengeIdArg(challengeId)
    ),
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = resolver.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const sig = await sendAndConfirmTransaction(connection, tx, [resolver], {
    commitment: "confirmed",
  });

  return sig;
}

/**
 * Server-side: refund the single funded player.
 *
 * Accounts (in order):
 *   0. challenge              [writable]
 *   1. vault                  [writable]
 *   2. usdcMint               []
 *   3. resolver               [writable, signer]
 *   4. recipient              []
 *   5. recipientAta           [writable]
 *   6. systemProgram          []
 *   7. tokenProgram           []
 *   8. associatedTokenProgram []
 */
export async function refundOnChain(
  challengeId: Uint8Array,
  fundedPlayerPubkey: PublicKey
): Promise<string> {
  const resolver = getResolverKeypair();
  const connection = getConnection();
  const [challengePda] = getChallengePda(challengeId);
  const vault = getAssociatedTokenAddressSync(USDC_MINT, challengePda, true);
  const recipientAta = getAssociatedTokenAddressSync(
    USDC_MINT,
    fundedPlayerPubkey
  );

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      w(challengePda),
      w(vault),
      r(USDC_MINT),
      ws(resolver.publicKey),
      r(fundedPlayerPubkey),
      w(recipientAta),
      r(SystemProgram.programId),
      r(TOKEN_PROGRAM_ID),
      r(ASSOCIATED_TOKEN_PROGRAM_ID),
    ],
    data: buildData(
      DISCRIMINATORS.refundOneSided,
      serializeChallengeIdArg(challengeId)
    ),
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = resolver.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const sig = await sendAndConfirmTransaction(connection, tx, [resolver], {
    commitment: "confirmed",
  });

  return sig;
}

/**
 * Server-side: forfeit vault to pool.
 *
 * Accounts (in order):
 *   0. challenge              [writable]
 *   1. vault                  [writable]
 *   2. usdcMint               []
 *   3. resolver               [writable, signer]
 *   4. poolAuthority          []
 *   5. poolAta                [writable]
 *   6. systemProgram          []
 *   7. tokenProgram           []
 *   8. associatedTokenProgram []
 */
export async function forfeitToPoolOnChain(
  challengeId: Uint8Array
): Promise<string> {
  const resolver = getResolverKeypair();
  const connection = getConnection();
  const [challengePda] = getChallengePda(challengeId);
  const vault = getAssociatedTokenAddressSync(USDC_MINT, challengePda, true);
  const [poolAuthority] = getPoolAuthorityPda();
  const poolAta = getAssociatedTokenAddressSync(USDC_MINT, poolAuthority, true);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      w(challengePda),
      w(vault),
      r(USDC_MINT),
      ws(resolver.publicKey),
      r(poolAuthority),
      w(poolAta),
      r(SystemProgram.programId),
      r(TOKEN_PROGRAM_ID),
      r(ASSOCIATED_TOKEN_PROGRAM_ID),
    ],
    data: buildData(
      DISCRIMINATORS.forfeitToPool,
      serializeChallengeIdArg(challengeId)
    ),
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = resolver.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const sig = await sendAndConfirmTransaction(connection, tx, [resolver], {
    commitment: "confirmed",
  });

  return sig;
}

import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "7aWP4zjjZpuMLLeD3EX8rjVepmoRTZ9rgh6Me9wRAnNv"
);

export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

export const STAKE_AMOUNT = 1_000_000; // 1 USDC

// Timing windows (ms)
export const FUNDING_WINDOW_MS = 2 * 60 * 1000; // 2 min
export const PLAY_WINDOW_MS = 60 * 60 * 1000; // 60 min
export const PROOF_WINDOW_MS = 10 * 60 * 1000; // 10 min

/** Derive the challenge PDA from a 16-byte challenge ID */
export function getChallengePda(challengeId: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("challenge"), Buffer.from(challengeId)],
    PROGRAM_ID
  );
}

/** Derive the pool authority PDA */
export function getPoolAuthorityPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool_authority")],
    PROGRAM_ID
  );
}

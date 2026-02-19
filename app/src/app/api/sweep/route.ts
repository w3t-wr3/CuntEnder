import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getServiceSupabase } from "@/lib/supabase/server";
import { refundOnChain, forfeitToPoolOnChain } from "@/lib/solana/transactions";
import { uuidToBytes } from "@/lib/utils/uuid-bytes";
import { PROOF_WINDOW_MS } from "@/lib/solana/program";

export async function POST() {
  const sb = getServiceSupabase();
  const now = new Date().toISOString();
  const results = { refunded: 0, moved_to_proof: 0, forfeited: 0, errors: [] as string[] };

  // 1. ACCEPTED challenges with expired funding window → refund or cancel
  const { data: expiredFunding } = await sb
    .from("challenges")
    .select("*, escrow(*), maker:users!challenges_maker_id_fkey(wallet_address), taker:users!challenges_taker_id_fkey(wallet_address)")
    .eq("status", "ACCEPTED")
    .lt("funding_expires_at", now);

  for (const c of expiredFunding ?? []) {
    try {
      const escrow = c.escrow;
      const hasMakerFund = !!escrow?.fund_tx_maker;
      const hasTakerFund = !!escrow?.fund_tx_taker;

      if (hasMakerFund && !hasTakerFund) {
        // Refund maker
        const idBytes = uuidToBytes(c.id);
        const makerWallet = (c.maker as { wallet_address: string }).wallet_address;
        const sig = await refundOnChain(idBytes, new PublicKey(makerWallet));
        await sb.from("escrow").update({ refund_tx: sig }).eq("challenge_id", c.id);
      } else if (!hasMakerFund && hasTakerFund) {
        // Refund taker
        const idBytes = uuidToBytes(c.id);
        const takerWallet = (c.taker as { wallet_address: string }).wallet_address;
        const sig = await refundOnChain(idBytes, new PublicKey(takerWallet));
        await sb.from("escrow").update({ refund_tx: sig }).eq("challenge_id", c.id);
      }

      await sb
        .from("challenges")
        .update({
          status: "CANCELLED_OR_FORFEIT",
          cancelled_reason: "Funding window expired",
        })
        .eq("id", c.id);

      results.refunded++;
    } catch (e) {
      results.errors.push(`refund ${c.id}: ${e}`);
    }
  }

  // 2. FUNDED challenges with expired play window → PROOF_PENDING
  const { data: expiredPlay } = await sb
    .from("challenges")
    .select("*")
    .eq("status", "FUNDED")
    .lt("play_expires_at", now);

  for (const c of expiredPlay ?? []) {
    try {
      await sb
        .from("challenges")
        .update({
          status: "PROOF_PENDING",
          proof_expires_at: new Date(Date.now() + PROOF_WINDOW_MS).toISOString(),
        })
        .eq("id", c.id);
      results.moved_to_proof++;
    } catch (e) {
      results.errors.push(`proof_pending ${c.id}: ${e}`);
    }
  }

  // 3. PROOF_PENDING challenges with expired proof window → forfeit to pool
  const { data: expiredProof } = await sb
    .from("challenges")
    .select("*")
    .eq("status", "PROOF_PENDING")
    .lt("proof_expires_at", now);

  for (const c of expiredProof ?? []) {
    try {
      const idBytes = uuidToBytes(c.id);
      const sig = await forfeitToPoolOnChain(idBytes);

      await sb
        .from("challenges")
        .update({
          status: "CANCELLED_OR_FORFEIT",
          cancelled_reason: "Proof window expired — forfeited to pool",
        })
        .eq("id", c.id);

      await sb
        .from("escrow")
        .update({ forfeit_tx: sig })
        .eq("challenge_id", c.id);

      results.forfeited++;
    } catch (e) {
      results.errors.push(`forfeit ${c.id}: ${e}`);
    }
  }

  return NextResponse.json(results);
}

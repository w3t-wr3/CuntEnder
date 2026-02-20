import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getServiceSupabase } from "@/lib/supabase/server";
import { resolveOnChain } from "@/lib/solana/transactions";
import { uuidToBytes } from "@/lib/utils/uuid-bytes";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { wallet_address } = await req.json();

    if (!wallet_address) {
      return NextResponse.json({ error: "wallet_address required" }, { status: 400 });
    }

    const sb = getServiceSupabase();

    // Find user
    const { data: user } = await sb
      .from("users")
      .select("id, wallet_address")
      .eq("wallet_address", wallet_address)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get challenge
    const { data: challenge } = await sb
      .from("challenges")
      .select("*")
      .eq("id", id)
      .single();

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    if (challenge.status === "RESOLVED") {
      return NextResponse.json({ error: "Already claimed" }, { status: 400 });
    }

    if (challenge.status !== "PROOF_PENDING" && challenge.status !== "FUNDED") {
      return NextResponse.json({ error: "Challenge not in claimable state" }, { status: 400 });
    }

    // Get proof with verified winner
    const { data: proof } = await sb
      .from("proofs")
      .select("verified_winner, confidence")
      .eq("challenge_id", id)
      .not("verified_winner", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!proof || !proof.verified_winner) {
      return NextResponse.json({ error: "No verified winner for this challenge" }, { status: 400 });
    }

    if (proof.confidence < 0.75) {
      return NextResponse.json({ error: "Winner confidence too low, manual review needed" }, { status: 400 });
    }

    // Verify caller is the winner
    if (proof.verified_winner !== user.id) {
      return NextResponse.json({ error: "You are not the verified winner" }, { status: 403 });
    }

    // Resolve on-chain — sends vault funds to winner
    const challengeIdBytes = uuidToBytes(id);
    const winnerPubkey = new PublicKey(wallet_address);
    const resolveSig = await resolveOnChain(challengeIdBytes, winnerPubkey);

    // Update challenge status
    await sb
      .from("challenges")
      .update({ status: "RESOLVED" })
      .eq("id", id);

    // Update escrow
    await sb
      .from("escrow")
      .update({ resolve_tx: resolveSig })
      .eq("challenge_id", id);

    return NextResponse.json({
      status: "RESOLVED",
      resolve_tx: resolveSig,
    });
  } catch (e) {
    console.error("Claim error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

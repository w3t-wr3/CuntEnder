import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getServiceSupabase } from "@/lib/supabase/server";
import { initChallengeOnChain } from "@/lib/solana/transactions";
import { getChallengePda, FUNDING_WINDOW_MS } from "@/lib/solana/program";
import { uuidToBytes } from "@/lib/utils/uuid-bytes";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { USDC_MINT } from "@/lib/solana/program";

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

    // Find taker user
    const { data: taker } = await sb
      .from("users")
      .select("id, wallet_address")
      .eq("wallet_address", wallet_address)
      .single();

    if (!taker) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check taker has RL identity
    const { data: takerIdentity } = await sb
      .from("game_identities")
      .select("username")
      .eq("user_id", taker.id)
      .eq("game", "rocket_league")
      .single();

    if (!takerIdentity) {
      return NextResponse.json(
        { error: "Set your Rocket League username first" },
        { status: 400 }
      );
    }

    // Get challenge
    const { data: challenge } = await sb
      .from("challenges")
      .select("*, maker:users!challenges_maker_id_fkey(id, wallet_address)")
      .eq("id", id)
      .single();

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    if (challenge.status !== "OPEN") {
      return NextResponse.json({ error: "Challenge not open" }, { status: 400 });
    }

    if (challenge.maker_id === taker.id) {
      return NextResponse.json({ error: "Cannot accept your own challenge" }, { status: 400 });
    }

    const makerWallet = (challenge.maker as { wallet_address: string }).wallet_address;

    // Init on-chain
    const challengeIdBytes = uuidToBytes(id);
    const makerPubkey = new PublicKey(makerWallet);
    const takerPubkey = new PublicKey(wallet_address);

    const initSig = await initChallengeOnChain(
      challengeIdBytes,
      makerPubkey,
      takerPubkey
    );

    // Derive PDA + vault for DB
    const [challengePda] = getChallengePda(challengeIdBytes);
    const vaultAta = getAssociatedTokenAddressSync(
      USDC_MINT,
      challengePda,
      true
    );

    const fundingExpiresAt = new Date(Date.now() + FUNDING_WINDOW_MS).toISOString();

    // Update challenge
    const { error: updateErr } = await sb
      .from("challenges")
      .update({
        taker_id: taker.id,
        status: "ACCEPTED",
        funding_expires_at: fundingExpiresAt,
      })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Create escrow record
    await sb.from("escrow").insert({
      challenge_id: id,
      challenge_pda: challengePda.toBase58(),
      vault_ata: vaultAta.toBase58(),
    });

    return NextResponse.json({
      status: "ACCEPTED",
      init_tx: initSig,
      funding_expires_at: fundingExpiresAt,
    });
  } catch (e) {
    console.error("Accept error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

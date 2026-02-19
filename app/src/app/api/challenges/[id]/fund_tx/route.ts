import { NextRequest, NextResponse } from "next/server";
import { PublicKey, Connection } from "@solana/web3.js";
import { getServiceSupabase } from "@/lib/supabase/server";
import { buildFundTx } from "@/lib/solana/transactions";
import { uuidToBytes } from "@/lib/utils/uuid-bytes";
import { PLAY_WINDOW_MS } from "@/lib/solana/program";

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  "confirmed"
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { wallet_address, tx_signature } = body;

    if (!wallet_address) {
      return NextResponse.json({ error: "wallet_address required" }, { status: 400 });
    }

    const sb = getServiceSupabase();

    // If no tx_signature, return unsigned transaction for client to sign
    if (!tx_signature) {
      const challengeIdBytes = uuidToBytes(id);
      const playerPubkey = new PublicKey(wallet_address);
      const serializedTx = await buildFundTx(
        challengeIdBytes,
        playerPubkey,
        connection
      );
      return NextResponse.json({ transaction: serializedTx });
    }

    // tx_signature provided: verify and record the funded tx
    // Verify on-chain
    const txInfo = await connection.getTransaction(tx_signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!txInfo || txInfo.meta?.err) {
      return NextResponse.json(
        { error: "Transaction not found or failed" },
        { status: 400 }
      );
    }

    // Find user
    const { data: user } = await sb
      .from("users")
      .select("id")
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

    if (!challenge || challenge.status !== "ACCEPTED") {
      return NextResponse.json({ error: "Challenge not in ACCEPTED state" }, { status: 400 });
    }

    const isMaker = user.id === challenge.maker_id;
    const isTaker = user.id === challenge.taker_id;

    if (!isMaker && !isTaker) {
      return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    }

    // Update escrow record
    const field = isMaker ? "fund_tx_maker" : "fund_tx_taker";
    await sb
      .from("escrow")
      .update({ [field]: tx_signature })
      .eq("challenge_id", id);

    // Check if both funded
    const { data: escrow } = await sb
      .from("escrow")
      .select("*")
      .eq("challenge_id", id)
      .single();

    const bothFunded = escrow?.fund_tx_maker && escrow?.fund_tx_taker;

    if (bothFunded) {
      const playExpiresAt = new Date(Date.now() + PLAY_WINDOW_MS).toISOString();
      await sb
        .from("challenges")
        .update({
          status: "FUNDED",
          play_expires_at: playExpiresAt,
        })
        .eq("id", id);

      return NextResponse.json({
        status: "FUNDED",
        play_expires_at: playExpiresAt,
      });
    }

    return NextResponse.json({
      status: "ACCEPTED",
      funded_by: isMaker ? "maker" : "taker",
    });
  } catch (e) {
    console.error("Fund error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

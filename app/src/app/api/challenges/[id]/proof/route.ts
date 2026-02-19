import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getServiceSupabase } from "@/lib/supabase/server";
import { verifyProof } from "@/lib/vision/verify-proof";
import { resolveOnChain } from "@/lib/solana/transactions";
import { PROOF_WINDOW_MS } from "@/lib/solana/program";
import { uuidToBytes } from "@/lib/utils/uuid-bytes";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { wallet_address, image_base64, media_type } = await req.json();

    if (!wallet_address || !image_base64) {
      return NextResponse.json(
        { error: "wallet_address and image_base64 required" },
        { status: 400 }
      );
    }

    const sb = getServiceSupabase();

    // Find user
    const { data: uploader } = await sb
      .from("users")
      .select("id")
      .eq("wallet_address", wallet_address)
      .single();

    if (!uploader) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get challenge
    const { data: challenge } = await sb
      .from("challenges")
      .select(
        "*, maker:users!challenges_maker_id_fkey(id, wallet_address), taker:users!challenges_taker_id_fkey(id, wallet_address)"
      )
      .eq("id", id)
      .single();

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Allow proof upload in FUNDED or PROOF_PENDING
    if (challenge.status !== "FUNDED" && challenge.status !== "PROOF_PENDING") {
      return NextResponse.json(
        { error: "Challenge not in a proof-accepting state" },
        { status: 400 }
      );
    }

    const isMaker = uploader.id === challenge.maker_id;
    const isTaker = uploader.id === challenge.taker_id;
    if (!isMaker && !isTaker) {
      return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    }

    // If moving from FUNDED to PROOF_PENDING, set timer
    if (challenge.status === "FUNDED") {
      await sb
        .from("challenges")
        .update({
          status: "PROOF_PENDING",
          proof_expires_at: new Date(
            Date.now() + PROOF_WINDOW_MS
          ).toISOString(),
        })
        .eq("id", id);
    }

    // Upload image to Supabase Storage
    const fileName = `${id}/${uploader.id}-${Date.now()}.png`;
    const imageBuffer = Buffer.from(image_base64, "base64");

    const { error: uploadErr } = await sb.storage
      .from("proofs")
      .upload(fileName, imageBuffer, {
        contentType: media_type ?? "image/png",
        upsert: true,
      });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
    }

    const { data: urlData } = sb.storage.from("proofs").getPublicUrl(fileName);
    const imageUrl = urlData?.publicUrl ?? fileName;

    // Run vision analysis
    const visionResult = await verifyProof(
      image_base64,
      media_type ?? "image/png"
    );

    // Get game identities for matching
    const makerWallet = (challenge.maker as { id: string; wallet_address: string })
      .wallet_address;
    const takerWallet = (challenge.taker as { id: string; wallet_address: string })
      .wallet_address;

    const { data: makerIdentity } = await sb
      .from("game_identities")
      .select("username")
      .eq("user_id", challenge.maker_id)
      .eq("game", "rocket_league")
      .single();

    const { data: takerIdentity } = await sb
      .from("game_identities")
      .select("username")
      .eq("user_id", challenge.taker_id)
      .eq("game", "rocket_league")
      .single();

    // Match winner name to a user
    let verifiedWinnerId: string | null = null;
    let winnerWallet: string | null = null;

    if (visionResult.success && visionResult.winner_name) {
      const winnerName = visionResult.winner_name.toLowerCase();
      if (
        makerIdentity &&
        winnerName === makerIdentity.username.toLowerCase()
      ) {
        verifiedWinnerId = challenge.maker_id;
        winnerWallet = makerWallet;
      } else if (
        takerIdentity &&
        winnerName === takerIdentity.username.toLowerCase()
      ) {
        verifiedWinnerId = challenge.taker_id;
        winnerWallet = takerWallet;
      }
    }

    // Save proof record
    await sb.from("proofs").insert({
      challenge_id: id,
      uploader_id: uploader.id,
      image_url: imageUrl,
      ocr_json: visionResult.raw_json,
      verified_winner: verifiedWinnerId,
      confidence: visionResult.confidence,
    });

    // If we have a verified winner with good confidence, resolve on-chain
    if (verifiedWinnerId && winnerWallet && visionResult.confidence >= 0.75) {
      try {
        const challengeIdBytes = uuidToBytes(id);
        const winnerPubkey = new PublicKey(winnerWallet);
        const resolveSig = await resolveOnChain(challengeIdBytes, winnerPubkey);

        await sb
          .from("challenges")
          .update({ status: "RESOLVED" })
          .eq("id", id);

        await sb
          .from("escrow")
          .update({ resolve_tx: resolveSig })
          .eq("challenge_id", id);

        return NextResponse.json({
          result: {
            winner_name: visionResult.winner_name,
            confidence: visionResult.confidence,
            resolved: true,
            resolve_tx: resolveSig,
          },
        });
      } catch (e) {
        console.error("On-chain resolve failed:", e);
        return NextResponse.json({
          result: {
            winner_name: visionResult.winner_name,
            confidence: visionResult.confidence,
            resolved: false,
            error: "On-chain resolve failed, manual review needed",
          },
        });
      }
    }

    // Could not auto-resolve
    return NextResponse.json({
      result: {
        winner_name: visionResult.winner_name,
        confidence: visionResult.confidence,
        resolved: false,
        reason: verifiedWinnerId
          ? "Low confidence"
          : "Could not match winner name to a participant",
      },
    });
  } catch (e) {
    console.error("Proof error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

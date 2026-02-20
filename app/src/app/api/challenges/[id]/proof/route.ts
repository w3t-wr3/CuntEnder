import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { verifyProof } from "@/lib/vision/verify-proof";
import { PROOF_WINDOW_MS } from "@/lib/solana/program";

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

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

    // Check if this player already uploaded a proof
    const { data: existingProof } = await sb
      .from("proofs")
      .select("id")
      .eq("challenge_id", id)
      .eq("uploader_id", uploader.id)
      .limit(1)
      .maybeSingle();

    if (existingProof) {
      return NextResponse.json(
        { error: "You already uploaded a screenshot" },
        { status: 400 }
      );
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

    // Get game identities for vision matching
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

    // Run vision analysis with player names
    const visionResult = await verifyProof(
      image_base64,
      media_type ?? "image/png",
      makerIdentity?.username,
      takerIdentity?.username
    );

    // Match vision winner to a user ID (for this individual screenshot)
    let thisWinnerId: string | null = null;

    if (visionResult.success && visionResult.winner_name) {
      console.log(
        `[proof] Vision winner: "${visionResult.winner_name}" | Maker: "${makerIdentity?.username}" | Taker: "${takerIdentity?.username}"`
      );

      if (makerIdentity && fuzzyMatch(visionResult.winner_name, makerIdentity.username)) {
        thisWinnerId = challenge.maker_id;
      } else if (takerIdentity && fuzzyMatch(visionResult.winner_name, takerIdentity.username)) {
        thisWinnerId = challenge.taker_id;
      } else {
        console.warn(
          `[proof] Could not match "${visionResult.winner_name}" to either player`
        );
      }
    }

    // Save proof — verified_winner stays null until both upload
    await sb.from("proofs").insert({
      challenge_id: id,
      uploader_id: uploader.id,
      image_url: imageUrl,
      ocr_json: {
        ...visionResult.raw_json,
        matched_winner_id: thisWinnerId,
      },
      verified_winner: null,
      confidence: visionResult.confidence,
    });

    // Check if BOTH players have now uploaded
    const { data: allProofs } = await sb
      .from("proofs")
      .select("uploader_id, ocr_json, confidence")
      .eq("challenge_id", id)
      .order("created_at", { ascending: false });

    const makerProof = allProofs?.find((p: any) => p.uploader_id === challenge.maker_id);
    const takerProof = allProofs?.find((p: any) => p.uploader_id === challenge.taker_id);

    if (makerProof && takerProof) {
      // Both uploaded — compare results
      const makerSaysWinner = (makerProof.ocr_json as any)?.matched_winner_id ?? null;
      const takerSaysWinner = (takerProof.ocr_json as any)?.matched_winner_id ?? null;

      console.log(
        `[proof] Both uploaded. Maker says: ${makerSaysWinner}, Taker says: ${takerSaysWinner}`
      );

      if (makerSaysWinner && takerSaysWinner && makerSaysWinner === takerSaysWinner) {
        // Both agree — set verified winner
        const avgConfidence = ((makerProof.confidence ?? 0) + (takerProof.confidence ?? 0)) / 2;

        // Update the most recent proof to have the verified winner
        await sb
          .from("proofs")
          .update({
            verified_winner: makerSaysWinner,
            confidence: avgConfidence,
          })
          .eq("challenge_id", id)
          .eq("uploader_id", uploader.id);

        return NextResponse.json({
          result: {
            winner_name: visionResult.winner_name,
            winner_id: makerSaysWinner,
            confidence: avgConfidence,
            both_uploaded: true,
            agreed: true,
          },
        });
      } else if (makerSaysWinner && takerSaysWinner && makerSaysWinner !== takerSaysWinner) {
        // Disagreement — flag for manual review
        return NextResponse.json({
          result: {
            winner_name: visionResult.winner_name,
            winner_id: null,
            confidence: 0,
            both_uploaded: true,
            agreed: false,
            dispute: "Screenshots show different winners. Manual review needed.",
          },
        });
      } else {
        // One or both couldn't match — partial result
        return NextResponse.json({
          result: {
            winner_name: visionResult.winner_name,
            winner_id: null,
            confidence: visionResult.confidence,
            both_uploaded: true,
            agreed: false,
            dispute: "Could not match winner from one or both screenshots.",
          },
        });
      }
    }

    // Only one player uploaded so far
    return NextResponse.json({
      result: {
        winner_name: visionResult.winner_name,
        winner_id: null,
        confidence: visionResult.confidence,
        both_uploaded: false,
        waiting: true,
      },
    });
  } catch (e) {
    console.error("Proof error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

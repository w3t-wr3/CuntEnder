import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

// GET /api/challenges — list challenges (lobby + single by id)
export async function GET(req: NextRequest) {
  try {
    const sb = getServiceSupabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      // Single challenge with proof data
      const { data: challenge, error } = await sb
        .from("challenges")
        .select(
          `
          *,
          maker:users!challenges_maker_id_fkey(id, wallet_address, display_name),
          taker:users!challenges_taker_id_fkey(id, wallet_address, display_name)
        `
        )
        .eq("id", id)
        .single();

      if (error || !challenge) {
        return NextResponse.json({ challenges: [] });
      }

      // Fetch latest proof with a verified winner
      const { data: proof } = await sb
        .from("proofs")
        .select("verified_winner, confidence")
        .eq("challenge_id", id)
        .not("verified_winner", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const enriched = {
        ...challenge,
        verified_winner_id: proof?.verified_winner ?? null,
        winner_confidence: proof?.confidence ?? null,
      };

      return NextResponse.json({ challenges: [enriched] });
    }

    // List active challenges
    const { data, error } = await sb
      .from("challenges")
      .select(
        `
        *,
        maker:users!challenges_maker_id_fkey(id, wallet_address, display_name),
        taker:users!challenges_taker_id_fkey(id, wallet_address, display_name)
      `
      )
      .in("status", ["OPEN", "ACCEPTED", "FUNDED", "PROOF_PENDING", "RESOLVED"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich resolved challenges with verified winner
    const resolvedIds = (data ?? [])
      .filter((c) => c.status === "RESOLVED")
      .map((c) => c.id);

    let winnerMap: Record<string, string> = {};
    if (resolvedIds.length > 0) {
      const { data: proofs } = await sb
        .from("proofs")
        .select("challenge_id, verified_winner")
        .in("challenge_id", resolvedIds)
        .not("verified_winner", "is", null);

      if (proofs) {
        for (const p of proofs) {
          winnerMap[p.challenge_id] = p.verified_winner;
        }
      }
    }

    const enriched = (data ?? []).map((c) => ({
      ...c,
      verified_winner_id: winnerMap[c.id] ?? null,
    }));

    return NextResponse.json({ challenges: enriched });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/challenges — create a new challenge
export async function POST(req: NextRequest) {
  try {
    const { wallet_address } = await req.json();

    if (!wallet_address) {
      return NextResponse.json(
        { error: "wallet_address required" },
        { status: 400 }
      );
    }

    const sb = getServiceSupabase();

    // Find user
    const { data: user } = await sb
      .from("users")
      .select("id")
      .eq("wallet_address", wallet_address)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check for RL identity
    const { data: identity } = await sb
      .from("game_identities")
      .select("username")
      .eq("user_id", user.id)
      .eq("game", "rocket_league")
      .single();

    if (!identity) {
      return NextResponse.json(
        { error: "Set your Rocket League username first" },
        { status: 400 }
      );
    }

    // Create challenge
    const { data: challenge, error } = await sb
      .from("challenges")
      .insert({
        maker_id: user.id,
        status: "OPEN",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ challenge });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

// GET /api/challenges — list open challenges (lobby)
export async function GET() {
  try {
    const sb = getServiceSupabase();

    const { data, error } = await sb
      .from("challenges")
      .select(
        `
        *,
        maker:users!challenges_maker_id_fkey(id, wallet_address, display_name),
        taker:users!challenges_taker_id_fkey(id, wallet_address, display_name)
      `
      )
      .in("status", ["OPEN", "ACCEPTED", "FUNDED", "PROOF_PENDING"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ challenges: data });
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

import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { wallet_address, username, platform = "epic" } = await req.json();

    if (!wallet_address || !username) {
      return NextResponse.json(
        { error: "wallet_address and username required" },
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

    // Upsert game identity
    const { data, error } = await sb
      .from("game_identities")
      .upsert(
        {
          user_id: user.id,
          game: "rocket_league",
          platform,
          username,
        },
        { onConflict: "user_id,game,platform" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ identity: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

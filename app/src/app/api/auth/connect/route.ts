import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { wallet_address } = await req.json();
    if (!wallet_address || typeof wallet_address !== "string") {
      return NextResponse.json({ error: "wallet_address required" }, { status: 400 });
    }

    const sb = getServiceSupabase();

    // Upsert user by wallet
    const { data: existing } = await sb
      .from("users")
      .select("*")
      .eq("wallet_address", wallet_address)
      .single();

    if (existing) {
      // Also fetch game identity
      const { data: identity } = await sb
        .from("game_identities")
        .select("*")
        .eq("user_id", existing.id)
        .eq("game", "rocket_league")
        .single();

      return NextResponse.json({ user: existing, identity });
    }

    // Create new user
    const { data: newUser, error } = await sb
      .from("users")
      .insert({ wallet_address })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: newUser, identity: null });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

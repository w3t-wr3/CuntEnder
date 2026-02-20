import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get("wallet");
    if (!wallet) {
      return NextResponse.json({ history: [] });
    }

    const sb = getServiceSupabase();

    const { data: user } = await sb
      .from("users")
      .select("id")
      .eq("wallet_address", wallet)
      .single();

    if (!user) {
      return NextResponse.json({ history: [] });
    }

    // Fetch resolved + cancelled challenges where user was maker or taker
    const { data: challenges } = await sb
      .from("challenges")
      .select(
        `
        id,
        status,
        usdc_amount_minor,
        maker_id,
        taker_id,
        created_at,
        cancelled_reason,
        maker:users!challenges_maker_id_fkey(id, display_name, wallet_address),
        taker:users!challenges_taker_id_fkey(id, display_name, wallet_address)
      `
      )
      .or(`maker_id.eq.${user.id},taker_id.eq.${user.id}`)
      .in("status", ["RESOLVED", "CANCELLED_OR_FORFEIT"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (!challenges) {
      return NextResponse.json({ history: [] });
    }

    // For resolved challenges, look up the verified winner
    const resolvedIds = challenges
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

    const history = challenges.map((c) => {
      const winnerId = winnerMap[c.id] ?? null;
      const isWinner = winnerId === user.id;
      const isLoser = winnerId !== null && winnerId !== user.id;
      const pot = (c.usdc_amount_minor * 2) / 1_000_000;
      const stake = c.usdc_amount_minor / 1_000_000;

      // Determine opponent (supabase joins can return object or array)
      const isMaker = c.maker_id === user.id;
      const rawOpponent = isMaker ? c.taker : c.maker;
      const opponent = Array.isArray(rawOpponent) ? rawOpponent[0] : rawOpponent;
      const o = opponent as any;
      const opponentName =
        o?.display_name ??
        (o?.wallet_address ? o.wallet_address.slice(0, 8) + "..." : "Unknown");

      let outcome: "win" | "loss" | "cancelled" = "cancelled";
      let amount = 0;
      if (c.status === "RESOLVED") {
        if (isWinner) {
          outcome = "win";
          amount = pot * 0.95 - stake; // net profit (winnings minus your stake)
        } else if (isLoser) {
          outcome = "loss";
          amount = stake;
        }
      }

      return {
        id: c.id,
        status: c.status,
        outcome,
        amount,
        opponent: opponentName,
        created_at: c.created_at,
        cancelled_reason: c.cancelled_reason,
      };
    });

    return NextResponse.json({ history });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

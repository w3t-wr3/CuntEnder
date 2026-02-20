import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ uploaded: false });
  }

  const sb = getServiceSupabase();

  const { data: user } = await sb
    .from("users")
    .select("id")
    .eq("wallet_address", wallet)
    .single();

  if (!user) {
    return NextResponse.json({ uploaded: false });
  }

  const { data: proof } = await sb
    .from("proofs")
    .select("id")
    .eq("challenge_id", id)
    .eq("uploader_id", user.id)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ uploaded: !!proof });
}

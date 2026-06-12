import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const { watchlist } = await req.json();
  if (!Array.isArray(watchlist)) {
    return NextResponse.json({ error: "watchlist must be an array" }, { status: 400 });
  }

  const supabase = getClient();
  const { data: rows } = await supabase
    .from("push_subscriptions")
    .select("id")
    .limit(1);

  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no subscription" });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .update({ watchlist, updated_at: new Date().toISOString() })
    .eq("id", rows[0].id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

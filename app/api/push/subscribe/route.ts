import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const subscription = await req.json();
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const supabase = getClient();
  // Single-user: clear old subscription and insert fresh
  await supabase.from("push_subscriptions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const { error } = await supabase
    .from("push_subscriptions")
    .insert({ subscription, watchlist: [], last_notified: {} });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

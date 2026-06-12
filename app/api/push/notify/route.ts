import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { checkTriggers } from "@/lib/push-triggers";
import { getPriceWithFallback } from "@/lib/price-sources";
import type { WatchlistEntry } from "@/types";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getClient();
  const { data: rows, error } = await supabase
    .from("push_subscriptions")
    .select("id, subscription, watchlist, last_notified")
    .limit(1);

  if (error || !rows || rows.length === 0) {
    return NextResponse.json({ ok: true, fired: 0 });
  }

  const row = rows[0];
  const watchlist: WatchlistEntry[] = row.watchlist ?? [];
  const lastNotified: Record<string, string> = row.last_notified ?? {};

  const triggers = await checkTriggers(
    watchlist,
    lastNotified,
    supabase,
    getPriceWithFallback
  );

  let fired = 0;
  const updatedNotified = { ...lastNotified };

  for (const t of triggers) {
    try {
      await webpush.sendNotification(
        row.subscription,
        JSON.stringify({ title: t.title, body: t.body, url: t.url })
      );
      updatedNotified[`${t.entry.id}_${t.trigger}`] = new Date().toISOString();
      fired++;
    } catch {
      // Subscription expired — clear it
      await supabase.from("push_subscriptions").delete().eq("id", row.id);
      return NextResponse.json({ ok: true, fired, note: "Subscription expired — cleared" });
    }
  }

  if (fired > 0) {
    await supabase
      .from("push_subscriptions")
      .update({ last_notified: updatedNotified, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  return NextResponse.json({ ok: true, fired });
}

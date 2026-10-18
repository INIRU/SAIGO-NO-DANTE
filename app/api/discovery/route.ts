import { NextResponse } from "next/server";
import { loadDiscovery } from "@/lib/discovery/feed";
import { popularSince, type PopularPeriod } from "@/lib/discovery/update-window";
import { COMMUNITY_FEED_CACHE_CONTROL } from "@/lib/constants/http-cache";
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const kind = q.get("kind") ?? "deck",
    period = q.get("period") ?? "week";
  if (!["deck", "planner"].includes(kind) || !["week", "month", "all"].includes(period))
    return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
  try {
    return NextResponse.json(await loadDiscovery(kind as "deck" | "planner", popularSince(period as PopularPeriod)), {
      headers: { "Cache-Control": COMMUNITY_FEED_CACHE_CONTROL },
    });
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { loadDiscovery } from "@/lib/discovery/feed";
import { COMMUNITY_FEED_CACHE_CONTROL } from "@/lib/constants/http-cache";
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const kind = q.get("kind") ?? "deck",
    days = Number(q.get("days") ?? 7);
  if (!["deck", "planner"].includes(kind) || ![0, 7, 30].includes(days))
    return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
  try {
    return NextResponse.json(await loadDiscovery(kind as "deck" | "planner", days), {
      headers: { "Cache-Control": COMMUNITY_FEED_CACHE_CONTROL },
    });
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/constants/cache-tags";
async function load(kind: "deck" | "planner", days: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(kind === "deck" ? CACHE_TAGS.decksList : CACHE_TAGS.plansList, CACHE_TAGS.gameData);
  const db = createAdminClient().schema("limbus");
  const columns =
    kind === "deck"
      ? "id,title,description,tags,main_keywords,lang,created_at,updated_at,vote_count,view_count,comment_count,deck_identities(slot_order,identities(id,sinner_id,folder_name,game_id,name_kr))"
      : "id,title,description,lang,difficulty,deck,egos,tags,created_at,updated_at,vote_count,view_count,comment_count";
  const table = kind === "deck" ? "decks" : "md_plans";
  const [counts, recent, updated] = await Promise.all([
    db.rpc("discovery_counts", { days }),
    db
      .from(table)
      .select(columns)
      .order("created_at", { ascending: false })
      .limit(6),
    db
      .from(table)
      .select(columns)
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);
  if (counts.error || recent.error || updated.error)
    throw Error("Discovery unavailable");
  const metrics = counts.data as {
    kind: string;
    entity_id: string;
    visitors: number;
  }[];
  const ids = metrics
    .filter((r) => r.kind === kind)
    .slice(0, 6)
    .map((r) => r.entity_id);
  const identityIds = metrics
    .filter((r) => r.kind === "identity")
    .slice(0, 12)
    .map((r) => r.entity_id);
  const [popular, identities] = await Promise.all([
    ids.length
      ? db.from(table).select(columns).in("id", ids)
      : Promise.resolve({ data: [], error: null }),
    identityIds.length
      ? db
          .from("identities")
          .select(
            "id,sinner_id,name_kr,name_en,name_jp,rarity,folder_name,game_id",
          )
          .in("id", identityIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (popular.error || identities.error) throw Error("Discovery unavailable");
  return {
    recent: recent.data,
    updated: updated.data,
    popular: popular.data,
    identities: identities.data,
    counts: metrics,
  };
}
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const kind = q.get("kind") ?? "deck",
    days = Number(q.get("days") ?? 7);
  if (!["deck", "planner"].includes(kind) || ![0, 7, 30].includes(days))
    return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
  try {
    return NextResponse.json(await load(kind as "deck" | "planner", days));
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}

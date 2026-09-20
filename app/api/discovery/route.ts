import { NextResponse } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripPlanForList } from "@/lib/planner/stripPlanForList";
import { CACHE_TAGS } from "@/lib/constants/cache-tags";
async function load(kind: "deck" | "planner", days: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(kind === "deck" ? CACHE_TAGS.decksList : CACHE_TAGS.plansList, CACHE_TAGS.gameData);
  const db = createAdminClient().schema("limbus");
  const columns: string =
    kind === "deck"
      ? "id,user_id,profiles!decks_user_id_fkey(username,avatar_url),title,description,tags,main_keywords,content_type,lang,created_at,updated_at,vote_count,view_count,comment_count,deck_identities(slot_order,identities(id,sinner_id,folder_name,game_id,name_kr))"
      : "id,user_id,profiles:user_id(username,avatar_url),title,description,lang,difficulty,deck,egos,floor_plan,tags,created_at,updated_at,vote_count,view_count,comment_count";
  const table = kind === "deck" ? "decks" : "md_plans";
  const [counts, recent, edits] = await Promise.all([
    db.rpc("discovery_counts", { days }),
    db
      .from(table)
      .select(columns)
      .order("created_at", { ascending: false })
      .limit(6),
    db.rpc("discovery_recent_edits", { p_kind: kind }),
  ]);
  if (counts.error || recent.error || edits.error)
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
  const identityRank = metrics
    .filter((r) => r.kind === "identity")
    .sort((a, b) => b.visitors - a.visitors || a.entity_id.localeCompare(b.entity_id))
    .slice(0, 12)
    .map((r) => r.entity_id);
  const editedIds = (edits.data as { entity_id: string }[]).map(row => row.entity_id);
  const [popular, identities, updated] = await Promise.all([
    ids.length
      ? db.from(table).select(columns).in("id", ids)
      : Promise.resolve({ data: [], error: null }),
    identityRank.length
      ? db
          .from("identities")
          .select(
            "id,sinner_id,name_kr,name_en,name_jp,rarity,folder_name,game_id",
          )
          .in("id", identityRank)
      : Promise.resolve({ data: [], error: null }),
    editedIds.length
      ? db.from(table).select(columns).in("id", editedIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (popular.error || identities.error || updated.error) throw Error("Discovery unavailable");
  const identityOrder = new Map(identityRank.map((id, index) => [id, index]));
  const orderedIdentities = [...(identities.data ?? [])].sort(
    (a, b) => (identityOrder.get(a.id) ?? Infinity) - (identityOrder.get(b.id) ?? Infinity),
  );
  const formatPosts = (rows: unknown[]) => rows.map(raw => {
    const row = raw as Record<string, unknown>;
    if (kind === "planner") return stripPlanForList(row);
    const profile = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as { username?: string | null } | null;
    return { ...row, username: profile?.username ?? undefined };
  });
  return {
    recent: formatPosts(recent.data ?? []),
    updated: formatPosts([...((updated.data ?? []) as unknown as { id: string }[])].sort((a, b) => editedIds.indexOf(a.id) - editedIds.indexOf(b.id))),
    popular: formatPosts(popular.data ?? []),
    identities: orderedIdentities,
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

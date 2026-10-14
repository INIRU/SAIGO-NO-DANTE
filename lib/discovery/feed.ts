import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/constants/cache-tags";
import { DISCOVERY_COLUMNS, DISCOVERY_TABLE, formatDiscoveryPosts } from "@/lib/discovery/recommend";
import { rankPopular } from "@/lib/discovery/shelf";

// Shared by /api/discovery and the home page community shelves.
export async function loadDiscovery(kind: "deck" | "planner", days: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(kind === "deck" ? CACHE_TAGS.decksList : CACHE_TAGS.plansList, CACHE_TAGS.gameData);
  const db = createAdminClient().schema("limbus");
  const columns = DISCOVERY_COLUMNS[kind], table = DISCOVERY_TABLE[kind];
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
  // Every ranked id (the DB function returns up to twelve per kind), so deleted posts leave no hole in the six.
  const visitors = new Map(metrics.filter((r) => r.kind === kind).map((r) => [r.entity_id, r.visitors]));
  const ids = [...visitors.keys()];
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
  const formatPosts = (rows: unknown[]) => formatDiscoveryPosts(kind, rows);
  return {
    recent: formatPosts(recent.data ?? []),
    updated: formatPosts([...((updated.data ?? []) as unknown as { id: string }[])].sort((a, b) => editedIds.indexOf(a.id) - editedIds.indexOf(b.id))),
    popular: formatPosts(rankPopular((popular.data ?? []) as unknown as { id: string }[], visitors)),
    identities: orderedIdentities,
    counts: metrics,
  };
}

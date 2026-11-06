import { NextResponse } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoveryUserId, DISCOVERY_COLUMNS, DISCOVERY_TABLE, formatDiscoveryPosts, interestProfile, postFeatures, recommend, type DiscoveryKind } from "@/features/community/server";
import { popularSince } from "@/lib/discovery/update-window";
import { CACHE_TAGS } from "@/lib/constants/cache-tags";

const headers = { "Cache-Control": "private, no-store" };
type Row = { id: string };

// Shared candidate pool (no user data): latest posts plus the last four update weeks' most visited ones.
async function pool(kind: DiscoveryKind, since: string | null) {
  "use cache";
  cacheLife("minutes");
  cacheTag(kind === "deck" ? CACHE_TAGS.decksList : CACHE_TAGS.plansList);
  const db = createAdminClient().schema("limbus");
  const [latest, counts] = await Promise.all([
    db.from(DISCOVERY_TABLE[kind]).select(DISCOVERY_COLUMNS[kind]).order("created_at", { ascending: false }).limit(60),
    db.rpc("discovery_counts_since", { since }),
  ]);
  if (latest.error || counts.error) throw Error("Pool unavailable");
  const popularIds = (counts.data as { kind: string; entity_id: string }[])
    .filter((r) => r.kind === kind)
    .map((r) => r.entity_id);
  const known = new Set((latest.data as unknown as Row[]).map((r) => r.id));
  const missing = popularIds.filter((id) => !known.has(id));
  const extra = missing.length
    ? await db.from(DISCOVERY_TABLE[kind]).select(DISCOVERY_COLUMNS[kind]).in("id", missing)
    : { data: [], error: null };
  if (extra.error) throw Error("Pool unavailable");
  return { posts: formatDiscoveryPosts(kind, [...latest.data, ...(extra.data ?? [])]), popularIds };
}

export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "deck" && kind !== "planner")
    return NextResponse.json({ error: "Invalid filter" }, { status: 400, headers });
  const email = (await getServerSession(authOptions))?.user?.email;
  if (!email) return NextResponse.json({ items: [] }, { headers });
  try {
    const db = createAdminClient().schema("limbus");
    // An unknown account gets no personal shelf; a failed lookup throws and is logged below.
    const userId = await discoveryUserId(db, email);
    if (!userId) return NextResponse.json({ items: [] }, { headers });
    const visits = await db
      .from("discovery_visits")
      .select("kind,entity_id")
      .eq("user_id", userId)
      .order("day", { ascending: false })
      .limit(60);
    if (visits.error || !visits.data.length) return NextResponse.json({ items: [] }, { headers });
    const idsOf = (k: string) =>
      [...new Set(visits.data.filter((v) => v.kind === k).map((v) => v.entity_id as string))].slice(0, 20);
    const identityIds = idsOf("identity"), deckIds = idsOf("deck"), planIds = idsOf("planner");
    const none = { data: [] as unknown[], error: null };
    const [identities, decks, plans, candidates] = await Promise.all([
      identityIds.length ? db.from("identities").select("id,sinner_id").in("id", identityIds) : none,
      deckIds.length ? db.from("decks").select(DISCOVERY_COLUMNS.deck).in("id", deckIds) : none,
      planIds.length ? db.from("md_plans").select(DISCOVERY_COLUMNS.planner).in("id", planIds) : none,
      pool(kind, popularSince("month")),
    ]);
    if (identities.error || decks.error || plans.error) throw Error("Unavailable");
    // Sinners count only from identity pages: every lineup covers most sinners, so post sinners would drown out real matches.
    const seenPost = (post: Record<string, unknown>) => ({ ...postFeatures(post), sinners: [] });
    const seen = [
      ...(identities.data as { id: string; sinner_id: string }[]).map((i) => ({
        identities: [i.id],
        sinners: [i.sinner_id],
        keywords: [],
      })),
      ...formatDiscoveryPosts("deck", decks.data ?? []).map(seenPost),
      ...formatDiscoveryPosts("planner", plans.data ?? []).map(seenPost),
    ];
    const items = recommend(
      candidates.posts as Row[],
      interestProfile(seen),
      new Set(kind === "deck" ? deckIds : planIds),
      candidates.popularIds,
    );
    return NextResponse.json({ items }, { headers });
  } catch (error) {
    console.error("[discovery/for-you]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unavailable" }, { status: 503, headers });
  }
}

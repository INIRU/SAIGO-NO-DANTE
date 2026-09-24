import { NextResponse } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/constants/cache-tags";
import {
  DISCOVERY_COLUMNS,
  DISCOVERY_TABLE,
  formatDiscoveryPosts,
  interestProfile,
  postFeatures,
  recommend,
  type DiscoveryKind,
} from "@/lib/discovery/recommend";

const headers = { "Cache-Control": "private, no-store" };
type Row = { id: string };

// Shared candidate pool (no user data): latest posts plus the month's most visited ones.
async function pool(kind: DiscoveryKind) {
  "use cache";
  cacheLife("minutes");
  cacheTag(kind === "deck" ? CACHE_TAGS.decksList : CACHE_TAGS.plansList);
  const db = createAdminClient().schema("limbus");
  const [latest, counts] = await Promise.all([
    db.from(DISCOVERY_TABLE[kind]).select(DISCOVERY_COLUMNS[kind]).order("created_at", { ascending: false }).limit(60),
    db.rpc("discovery_counts", { days: 30 }),
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
    // An unknown account or a database without the user_id migration simply gets no personal shelf.
    const user = await db.rpc("discovery_user_id", { user_email: email });
    if (user.error || !user.data) return NextResponse.json({ items: [] }, { headers });
    const visits = await db
      .from("discovery_visits")
      .select("kind,entity_id")
      .eq("user_id", user.data)
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
      pool(kind),
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
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503, headers });
  }
}

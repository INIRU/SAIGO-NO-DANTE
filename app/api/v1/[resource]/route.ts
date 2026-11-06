import { z } from "zod";
import { NextResponse } from "next/server";
import { publicSupabase } from "@/lib/supabase/public";
import {
  RESOURCES,
  allows,
  consumeApiKey,
  loadCatalog,
  loadCatalogItem,
  loadDeckDetail,
  loadPlanDetail,
  parseLang,
  presentCatalogItem,
  presentDeck,
  presentPlan,
  withLinks,
} from "@/features/account/server";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization",
  "Access-Control-Expose-Headers": "X-RateLimit-Remaining, Retry-After",
  "Cache-Control": "no-store",
};
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}
const fail = (error: string, status: number, headers: Record<string, string> = cors) =>
  NextResponse.json({ error }, { status, headers });
export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const { resource } = await params;
  const definition = RESOURCES[resource];
  if (!definition) return fail("Not found", 404);
  try {
    const key = await consumeApiKey(request.headers.get("authorization"));
    if (key.refusal)
      return fail(
        key.refusal.error,
        key.refusal.status,
        key.refusal.retry ? { ...cors, "Retry-After": String(key.refusal.retry) } : cors,
      );
    const quota = key.access;
    // Game data and the formation detail of a deck or plan need the catalog scope.
    const catalog = allows(quota, "catalog:read");
    if (definition.partner && !catalog)
      return fail("Partner access required", 403);
    const url = new URL(request.url);
    const lang = parseLang(url.searchParams.get("lang"));
    if (!lang) return fail("lang: ko, en or ja", 400);
    const id = url.searchParams.get("id");
    const isUuid = z.string().uuid().safeParse(id).success;
    // Partner keys have no daily quota, so there is no remaining count to report.
    const headers = {
      ...cors,
      ...(quota.remaining == null
        ? {}
        : { "X-RateLimit-Remaining": String(quota.remaining) }),
    };
    if (definition.partner) {
      let rows;
      if (id && (resource === "identities" || resource === "egos")) {
        if (!isUuid) return fail("Invalid id", 400);
        const item = await loadCatalogItem(resource, id);
        rows = item ? [item] : [];
      } else {
        rows = await loadCatalog(resource);
        // Gifts are referred to by game id and keywords by their Korean name.
        if (id)
          rows = rows.filter((row) =>
            [row.id, row.game_id, row.name].some((key) => String(key) === id),
          );
      }
      return NextResponse.json(
        { data: rows.map((row) => presentCatalogItem(resource, row, lang)) },
        { headers },
      );
    }
    if (id && !isUuid) return fail("Invalid id", 400);
    if (id && catalog) {
      let data: unknown[] = [];
      if (resource === "decks") {
        const deck = await loadDeckDetail(id);
        if (deck) data = [presentDeck(deck, lang)];
      } else {
        const [detail, themes, gifts] = await Promise.all([
          loadPlanDetail(id),
          loadCatalog("theme-packs"),
          loadCatalog("ego-gifts"),
        ]);
        if (detail)
          data = [
            presentPlan(
              detail.plan,
              { identities: detail.identities, egos: detail.egos, themes, gifts },
              lang,
            ),
          ];
      }
      return NextResponse.json(
        { data, offset: 0, limit: 1, nextOffset: null },
        { headers },
      );
    }
    const offset = Number(url.searchParams.get("offset") ?? 0),
      limit = Number(url.searchParams.get("limit") ?? 20);
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 100000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    )
      return fail("offset: 0–100000; limit: 1–50", 400);
    const sort = url.searchParams.get("sort") ?? "recent";
    const search = url.searchParams.get("q")?.trim() ?? "";
    if (!["recent", "popular"].includes(sort) || search.length > 100)
      return fail("sort: recent or popular; q: up to 100 characters", 400);
    // Public credentials preserve the same RLS boundary as the public site.
    const db = publicSupabase();
    const columns =
      resource === "decks"
        ? "id,title,description,lang,main_keywords,tags,created_at,updated_at,vote_count,view_count,deck_identities(identity_id,slot_order),deck_egos(ego_id,grade)"
        : "id,title,description,lang,difficulty,deck,egos,floor_plan,gift_inventory,tags,created_at,updated_at,vote_count,view_count";
    let query = db
      .schema("limbus")
      .from(resource === "decks" ? "decks" : "md_plans")
      .select(columns);
    if (sort === "popular")
      query = query.order("vote_count", { ascending: false });
    query = query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);
    if (id) query = query.eq("id", id);
    // The search term is matched literally: LIKE wildcards in it are escaped.
    if (search)
      query = query.ilike("title", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data as unknown as Record<string, unknown>[];
    return NextResponse.json(
      {
        data: catalog
          ? rows.map((row) =>
              withLinks(resource as "decks" | "planners", row, lang),
            )
          : rows,
        offset,
        limit,
        nextOffset: rows.length === limit ? offset + limit : null,
      },
      { headers },
    );
  } catch {
    return fail("Service unavailable", 503);
  }
}

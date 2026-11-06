import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { allows, consumeApiKey, type KeyAccess } from "@/features/account/server";
import { CACHE_TAGS } from "@/lib/constants/cache-tags";
import { SITE_URL } from "@/lib/seo/metadata";
import { kstDay, parseNews } from "@/features/news";

const MAX_BODY = 64 * 1024;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Expose-Headers": "Retry-After",
  "Cache-Control": "no-store",
};
const fail = (error: string, status: number, extra: Record<string, unknown> = {}, headers: Record<string, string> = cors) =>
  NextResponse.json({ error, ...extra }, { status, headers });
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

/** The key's access, or the response that refuses it. */
async function authorize(request: Request): Promise<KeyAccess | NextResponse> {
  const result = await consumeApiKey(request.headers.get("authorization"));
  if (result.refusal) {
    const { status, error, retry } = result.refusal;
    return fail(error, status, {}, retry ? { ...cors, "Retry-After": String(retry) } : cors);
  }
  return allows(result.access, "news:write") ? result.access : fail("Partner scope news:write required", 403);
}
// An administrator key has the scope for checking the tools, but a stored item must belong to a partner.
const needsPartner = () => fail("Storing news needs a partner account; an administrator key can only dry-run", 403);

/** Stores a news item for the calendar. The same `id` again replaces it; `?dry_run=1` only validates. */
export async function POST(request: Request) {
  try {
    const access = await authorize(request);
    if (access instanceof NextResponse) return access;
    const dryRun = new URL(request.url).searchParams.get("dry_run") === "1";
    if (!dryRun && !access.partner) return needsPartner();
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY) return fail("Body over 64KB", 413);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return fail("Invalid JSON", 400);
    }
    const parsed = parseNews(body);
    if (!parsed.ok) return fail("Invalid news item", 400, { issues: parsed.issues });
    const { id, ...item } = parsed.value;
    const day = kstDay(item.published_at);
    const url = `${SITE_URL}/ko/calendar?date=${day}`;
    if (dryRun) return NextResponse.json({ data: { id, dry_run: true, day, url, item } }, { headers: cors });

    const db = createAdminClient().schema("limbus");
    const existing = await db.from("news_items").select("id").eq("partner", access.partner).eq("external_id", id).maybeSingle();
    if (existing.error) throw existing.error;
    const { error } = await db
      .from("news_items")
      .upsert({ ...item, partner: access.partner, external_id: id, updated_at: new Date().toISOString() }, { onConflict: "partner,external_id" });
    if (error) throw error;
    revalidateTag(CACHE_TAGS.news, "max");
    return NextResponse.json({ data: { id, created: !existing.data, day, url } }, { status: existing.data ? 200 : 201, headers: cors });
  } catch {
    return fail("Service unavailable", 503);
  }
}

/** Removes an item this key's partner posted. */
export async function DELETE(request: Request) {
  try {
    const access = await authorize(request);
    if (access instanceof NextResponse) return access;
    if (!access.partner) return needsPartner();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return fail("id required", 400);
    const { data, error } = await createAdminClient().schema("limbus").from("news_items").delete().eq("partner", access.partner).eq("external_id", id).select("id");
    if (error) throw error;
    if (data.length) revalidateTag(CACHE_TAGS.news, "max");
    return NextResponse.json({ data: { id, deleted: data.length > 0 } }, { headers: cors });
  } catch {
    return fail("Service unavailable", 503);
  }
}

import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey, readApiKey } from "@/lib/developer/keys";
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
export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const { resource } = await params;
  if (!["decks", "planners"].includes(resource))
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: cors },
    );
  const token = readApiKey(request.headers.get("authorization"));
  if (!token)
    return NextResponse.json(
      { error: "Bearer API key required" },
      { status: 401, headers: cors },
    );
  try {
    const { data: quota, error: quotaError } = await createAdminClient()
      .schema("limbus")
      .rpc("consume_developer_request", { token_hash: hashApiKey(token) });
    if (quotaError) throw quotaError;
    if (quota.status !== 200)
      return NextResponse.json(
        {
          error:
            quota.status === 429 ? "Rate limit exceeded" : "Key unavailable",
        },
        {
          status: quota.status,
          headers: { ...cors, "Retry-After": String(quota.retry ?? 60) },
        },
      );
    const url = new URL(request.url);
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
      return NextResponse.json(
        { error: "offset: 0–100000; limit: 1–50" },
        { status: 400, headers: cors },
      );
    // Public credentials preserve the same RLS boundary as the public site.
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    const columns =
      resource === "decks"
        ? "id,title,description,lang,main_keywords,tags,created_at,updated_at,vote_count,view_count,deck_identities(identity_id,slot_order),deck_egos(ego_id,grade)"
        : "id,title,description,lang,difficulty,deck,egos,floor_plan,gift_inventory,tags,created_at,updated_at,vote_count,view_count";
    let query = db
      .schema("limbus")
      .from(resource === "decks" ? "decks" : "md_plans")
      .select(columns)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);
    const id = url.searchParams.get("id");
    if (id) {
      if (!z.string().uuid().safeParse(id).success)
        return NextResponse.json(
          { error: "Invalid id" },
          { status: 400, headers: cors },
        );
      query = query.eq("id", id);
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(
      {
        data,
        offset,
        limit,
        nextOffset: data.length === limit ? offset + limit : null,
      },
      {
        headers: { ...cors, "X-RateLimit-Remaining": String(quota.remaining) },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503, headers: cors },
    );
  }
}

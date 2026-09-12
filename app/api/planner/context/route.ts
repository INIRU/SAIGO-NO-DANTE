import { NextResponse } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/constants/cache-tags";
async function context() {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.themes);
  const db = createAdminClient().schema("limbus");
  const events = await db.from("md_events")
    .select("id,image_url,name,name_en,name_jp,desc_text,desc_text_en,desc_text_jp,gift_ids,theme_ids")
    .eq("category", "entry");
  if (events.error) throw Error("Game context unavailable");
  return { events: events.data };
}
export async function GET() {
  try {
    return NextResponse.json(await context());
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}

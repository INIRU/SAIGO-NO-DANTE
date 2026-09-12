import { NextResponse } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/constants/cache-tags";
async function context() {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.themes);
  const db = createAdminClient().schema("limbus");
  const [events, themes] = await Promise.all([
    db
      .from("md_events")
      .select(
        "id,name,name_en,name_jp,desc_text,desc_text_en,desc_text_jp,gift_ids,theme_ids",
      )
      .eq("category", "entry"),
    db
      .from("ego_gift_themes")
      .select("id,name,boss_image_url,specific_ego_gift_ids"),
  ]);
  if (events.error || themes.error) throw Error("Game context unavailable");
  return { events: events.data, themes: themes.data };
}
export async function GET() {
  try {
    return NextResponse.json(await context());
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}

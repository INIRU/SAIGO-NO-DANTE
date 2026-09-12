import { NextResponse } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/constants/cache-tags";
async function load(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.gameData);
  const { data, error } = await createAdminClient()
    .schema("limbus")
    .rpc("identity_interest", { identity_id: id });
  if (error) throw error;
  return data;
}
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    return NextResponse.json(await load(id));
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}

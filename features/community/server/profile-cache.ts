import "server-only";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/constants/cache-tags";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from '@/lib/supabase/database.types'
export async function invalidateProfileDecks(
  db: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await db
    .schema("limbus")
    .from("decks")
    .select("id")
    .eq("user_id", userId);
  if (error) throw error;
  revalidateTag(CACHE_TAGS.decksList, { expire: 0 });
  for (const deck of data ?? [])
    revalidateTag(CACHE_TAGS.deck(deck.id), { expire: 0 });
}

import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { COMMUNITY_SETTING_KEYS, type CommunitySettings, type CommunityProfile } from "./rules";
import { stripPlanForList } from "@/lib/planner/stripPlanForList";
import { listUserSeries } from "@/lib/series/server";
export async function loadCommunityProfile(
  db: ReturnType<typeof createAdminClient>,
  id: string,
  owner = false,
): Promise<CommunityProfile | null> {
  const profileResult = await db
    .schema("limbus")
    .from("profiles")
    // The switches are read for everyone but returned only to the owner (settings below).
    .select("id,username,bio,avatar_url,created_at,suspended,public_profile,public_following,public_followers,notify_comments,notify_follows,notify_posts")
    .eq("id", id)
    .maybeSingle();
  if (profileResult.error) throw new Error("Profile lookup failed");
  const row = profileResult.data;
  if (!row || (!owner && (!row.public_profile || row.suspended))) return null;
  const [summary, decks, plans, eggs, series] = await Promise.all([
    db.schema("limbus").rpc("community_summary", { p_user_id: id }),
    db
      .schema("limbus")
      .from("decks")
      .select("id,title,description,tags,main_keywords,content_type,vote_count,view_count,comment_count,created_at,lang,deck_identities(slot_order,gacksung,identities(sinner_id,folder_name,game_id,keywords))")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
    db
      .schema("limbus")
      .from("md_plans")
      .select("id,user_id,title,description,lang,difficulty,deck,egos,floor_plan,gift_inventory,tags,created_at,vote_count,view_count,comment_count,profiles:user_id(username,avatar_url)")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
    db.schema("limbus").from("profile_easter_eggs").select("egg").eq("user_id", id),
    // The series list is an extra: a failed read must not hide the profile.
    listUserSeries(db, id, { hideEmpty: true }).catch(() => []),
  ]);
  if (summary.error || decks.error || plans.error || eggs.error) throw new Error("Community lookup failed");
  // Never spread the database profile: IPs, device signals, email and account fields stay private.
  return {
    profile: {
      id: row.id,
      username: row.username,
      bio: row.bio,
      avatar_url: row.avatar_url,
      created_at: row.created_at,
      public_profile: row.public_profile,
    },
    stats: summary.data,
    decks: (decks.data ?? []) as unknown as CommunityProfile["decks"],
    plans: (plans.data ?? []).map((plan) => stripPlanForList(plan as Record<string, unknown>)),
    series,
    eggs: (eggs.data ?? []).map((egg) => egg.egg as CommunityProfile["eggs"][number]),
    ...(owner && { settings: Object.fromEntries(COMMUNITY_SETTING_KEYS.map((key) => [key, row[key] === true])) as CommunitySettings }),
  };
}

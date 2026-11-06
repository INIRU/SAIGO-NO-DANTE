import { z } from "zod";

export const ACTIVITY_RULES = {
  deck: { points: 20, dailyLimit: 3 },
  // A plan is much more work than a deck (floors, gifts, notes).
  plan: { points: 40, dailyLimit: 3 },
  like: { points: 2, dailyLimit: 5 },
  contribution: { points: 50, dailyLimit: null },
} as const;
export type ActivityKind = keyof typeof ACTIVITY_RULES;
export const COMMUNITY_SETTING_KEYS = ['public_profile', 'public_following', 'public_followers', 'notify_comments', 'notify_follows', 'notify_posts'] as const;
/** The owner's visibility and notification switches. */
export type CommunitySettings = Record<(typeof COMMUNITY_SETTING_KEYS)[number], boolean>;
export const communitySettingsSchema = z
  .object(Object.fromEntries(COMMUNITY_SETTING_KEYS.map((key) => [key, z.boolean().optional()])) as Record<keyof CommunitySettings, z.ZodOptional<z.ZodBoolean>>)
  .strict().refine((data) => Object.keys(data).length > 0);

export type CommunityProfile = {
  profile: {
    id: string;
    username: string | null;
    bio: string | null;
    avatar_url: string | null;
    created_at: string;
    public_profile: boolean;
  };
  stats: Record<ActivityKind, number> & { points: number };
  /** The latest public decks, in the deck board's card shape. */
  decks: DeckSummary[];
  /** The latest plans, in the plan board's card shape. */
  plans: PlanSummary[];
  /** Series with at least one post, newest first. */
  series?: { id: string; title: string; count: number }[];
  /** Easter eggs found on the account (any browser). */
  eggs: EasterEgg[];
  /** Only in the owner's own profile. */
  settings?: CommunitySettings;
};
import type { DeckSummary } from "@/features/decks/components/DeckCard";
import type { PlanSummary } from "@/components/planner/PlanCard";
import type { EasterEgg } from "@/lib/easter-eggs";

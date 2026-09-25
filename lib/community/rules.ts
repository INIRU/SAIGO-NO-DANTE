import { z } from "zod";

export const ACTIVITY_RULES = {
  deck: { points: 20, dailyLimit: 3 },
  plan: { points: 20, dailyLimit: 3 },
  like: { points: 2, dailyLimit: 5 },
  contribution: { points: 50, dailyLimit: null },
} as const;
export type ActivityKind = keyof typeof ACTIVITY_RULES;
export const communitySettingsSchema = z
  .object({ public_profile: z.boolean().optional(), public_following: z.boolean().optional(), public_followers: z.boolean().optional() })
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
  /** Easter eggs found on the account (any browser). */
  eggs: EasterEgg[];
};
import type { DeckSummary } from "@/components/decks/DeckCard";
import type { PlanSummary } from "@/components/planner/PlanCard";
import type { EasterEgg } from "./easter-eggs";

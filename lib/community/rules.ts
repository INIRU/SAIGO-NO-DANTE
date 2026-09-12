import { z } from "zod";

export const ACTIVITY_RULES = {
  deck: { points: 20, dailyLimit: 3 },
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
  decks: {
    id: string;
    title: string;
    description: string | null;
    vote_count: number;
    created_at: string;
    lang: string;
  }[];
};

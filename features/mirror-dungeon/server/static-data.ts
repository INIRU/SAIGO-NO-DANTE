import { GIFT_COLUMNS, RECIPE_COLUMNS, THEME_COLUMNS } from '@/lib/db/columns'
import type { createAdminClient } from '@/lib/supabase/admin'
import { OBSERVATION_COLUMNS, type ObservationRow } from '@/features/planner'

type AdminClient = ReturnType<typeof createAdminClient>

// The game data every mirror dungeon page reads. Plain queries: each page decides how its result is cached ('use cache',
// cacheLife, cacheTag) and which of the four it needs.

/** Every theme pack. */
export const themesQuery = (supabase: AdminClient) => supabase.schema('limbus').from('ego_gift_themes').select(THEME_COLUMNS)

/** Every E.G.O gift, by keyword and grade. */
export const giftsQuery = (supabase: AdminClient) => supabase.schema('limbus').from('ego_gifts').select(GIFT_COLUMNS).order('keyword').order('grade')

/** Every fusion recipe. */
export const recipesQuery = (supabase: AdminClient) => supabase.schema('limbus').from('ego_gift_recipes').select(RECIPE_COLUMNS)

/** The latest season's start observation (one row, or none yet). */
export const observationQuery = (supabase: AdminClient) => supabase.schema('limbus').from('md_observation').select(OBSERVATION_COLUMNS)
  .order('mirror_dungeon_id', { ascending: false }).limit(1).maybeSingle<ObservationRow>()

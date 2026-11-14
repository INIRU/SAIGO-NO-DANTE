import { notFound } from 'next/navigation'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { createAdminClient } from '@/lib/supabase/admin'
import { MD_EVENT_COLUMNS, MD_EVENT_CHOICE_COLUMNS } from '@/lib/db/columns'
import { normalizePlannerThemeId } from '@/lib/planner/types'
import type { MdEvent, MdEventChoice } from '@/features/mirror-dungeon'
import { giftsQuery, themesQuery } from '@/features/mirror-dungeon/server'
import PipPreviewWrapper from './PipPreviewWrapper'

/**
 * Development only: every Assist PiP view side by side at the window sizes players use, from real gifts and packs, so a
 * change to the PiP is seen at once without a game or a capture. Not served in production.
 */
export default async function PipPreviewPage() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.mirrorDungeon, CACHE_TAGS.gameData)
  if (process.env.NODE_ENV !== 'development') notFound()
  const supabase = createAdminClient()
  const [{ data: themes }, { data: gifts }, { data: events }, { data: choices }] = await Promise.all([
    themesQuery(supabase),
    giftsQuery(supabase),
    supabase.schema('limbus').from('md_events').select(MD_EVENT_COLUMNS).order('id').limit(40),
    supabase.schema('limbus').from('md_event_choices').select(MD_EVENT_CHOICE_COLUMNS).order('event_id').order('sort_order').limit(200),
  ])
  const normalizedThemes = (themes ?? []).flatMap(theme => {
    const id = normalizePlannerThemeId(theme.id)
    return id === null ? [] : [{ ...theme, id }]
  })
  return <PipPreviewWrapper themes={normalizedThemes} gifts={gifts ?? []} events={(events ?? []) as MdEvent[]} eventChoices={(choices ?? []) as MdEventChoice[]} />
}

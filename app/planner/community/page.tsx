import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripPlanForList } from '@/lib/planner/stripPlanForList'
import type { PlanSummary } from '@/components/planner/PlanCard'
import CommunityClient from './CommunityClient'
import { getServerLang, serverT } from '@/lib/i18n/server'
import type { TranslationKey } from '@/lib/i18n/translations'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang()
  return {
    title: serverT('planner.community' as TranslationKey, lang),
    description: serverT('planner.community' as TranslationKey, lang),
    alternates: { canonical: 'https://saigo-no-dante.com/planner/community' },
  }
}

const PAGE_SIZE = 20

export default async function CommunityPage() {
  'use cache'
  cacheLife('page-1m')
  let initialPlans: PlanSummary[] = []
  let initialTotal = 0

  try {
    const supabase = createAdminClient()
    const { data, count, error } = await supabase
      .schema('limbus')
      .from('md_plans')
      .select(
        'id, title, description, difficulty, deck, egos, tags, vote_count, view_count, comment_count, created_at, user_id, profiles:user_id(username, avatar_url)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)

    if (!error && data) {
      initialPlans = data.map(plan => stripPlanForList(plan as Record<string, unknown>))
      initialTotal = count ?? 0
    }
  } catch {
    // Fall back to client-side fetch if server fetch fails
  }

  return (
    <Suspense fallback={null}>
      <CommunityClient initialPlans={initialPlans} initialTotal={initialTotal} />
    </Suspense>
  )
}

import { BoardShelfSkeleton } from '@/components/discovery/BoardSkeleton'
import type { Metadata } from 'next'
import { assistAvailable } from '@/lib/assist/availability'
import { localeAlternates } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import BoardHeader from '@/components/discovery/BoardHeader'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripPlanForList } from '@/lib/planner/stripPlanForList'
import type { PlanSummary } from '@/components/planner/PlanCard'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import CommunityClient from './CommunityClient'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'planner.communityBoard.meta' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: localeAlternates(lang, '/planner/community'),
  }
}

const PAGE_SIZE = 20
const SUPPORTED_LANGS = ['ko', 'en', 'ja'] as const
const CARD_META_CACHE_VERSION = 'compact-difficulty-v3-main-keyword-fallback'

function normalizePlannerLang(lang: string): typeof SUPPORTED_LANGS[number] {
  return lang === 'en' || lang === 'ja' ? lang : 'ko'
}

async function getCachedInitialPlans(lang: string, cardMetaVersion: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.plansList)
  void cardMetaVersion
  let initialPlans: PlanSummary[] = []
  let initialTotal = 0

  try {
    const supabase = createAdminClient()
    const { data, count, error } = await supabase
      .schema('limbus')
      .from('md_plans')
      .select(
        'id, title, description, difficulty, deck, egos, floor_plan, gift_inventory, tags, lang, vote_count, view_count, comment_count, created_at, user_id, guest_tag, profiles:user_id(username, avatar_url)',
        { count: 'exact' }
      )
      .eq('lang', normalizePlannerLang(lang))
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)

    if (!error && data) {
      initialPlans = data.map(plan => stripPlanForList(plan as Record<string, unknown>))
      initialTotal = count ?? 0
    }
  } catch {
    // Fall back to client-side fetch if server fetch fails
  }

  return { initialPlans, initialTotal }
}

export default async function CommunityPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'planner.communityBoard.header' })
  const tActions = await getTranslations({ locale: lang, namespace: 'planner.actions' })
  const { initialPlans, initialTotal } = await getCachedInitialPlans(lang, CARD_META_CACHE_VERSION)

  return (
    <div className="community-board flex min-h-screen flex-col" style={{ background: 'var(--bg-deep)' }}>
      <BoardHeader kind="planner" lang={lang} title={t('title')} subtitle={t('subtitle')} action={t('newPlan')} assist={assistAvailable(lang) ? tActions('triggerMode') : undefined} />
      <Suspense fallback={<BoardShelfSkeleton kind="planner" />}>
        <CommunityClient initialPlans={initialPlans} initialTotal={initialTotal} />
      </Suspense>
    </div>
  )
}

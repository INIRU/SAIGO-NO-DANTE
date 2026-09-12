import type { Metadata } from 'next'
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
    alternates: { canonical: 'https://saigo-no-dante.com/planner/community' },
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
        'id, title, description, difficulty, deck, egos, floor_plan, tags, lang, vote_count, view_count, comment_count, created_at, user_id, profiles:user_id(username, avatar_url)',
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

function CommunityPageSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-16 md:px-6">
      <div className="mx-auto flex w-full max-w-7xl gap-5">
        <div className="hidden h-[34rem] w-64 shrink-0 rounded-sm lg:block" style={{ background: 'rgba(26,21,16,0.5)' }} />
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 rounded-sm" style={{ background: 'rgba(26,21,16,0.55)' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function CommunityPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'planner.communityBoard.header' })
  const { initialPlans, initialTotal } = await getCachedInitialPlans(lang, CARD_META_CACHE_VERSION)

  return (
    <div className="community-board flex h-[100dvh] flex-col overflow-hidden" style={{ background: 'var(--bg-deep)' }}>
      <BoardHeader kind="planner" lang={lang} title={t('title')} subtitle={t('subtitle')} eyebrow={t('eyebrow')} action={t('newPlan')} />
      <Suspense fallback={<CommunityPageSkeleton />}>
        <CommunityClient initialPlans={initialPlans} initialTotal={initialTotal} />
      </Suspense>
    </div>
  )
}

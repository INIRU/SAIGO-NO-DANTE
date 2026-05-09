import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/lib/i18n/navigation'
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

function normalizePlannerLang(lang: string): typeof SUPPORTED_LANGS[number] {
  return lang === 'en' || lang === 'ja' ? lang : 'ko'
}

async function getCachedInitialPlans(lang: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.plansList)
  let initialPlans: PlanSummary[] = []
  let initialTotal = 0

  try {
    const supabase = createAdminClient()
    const { data, count, error } = await supabase
      .schema('limbus')
      .from('md_plans')
      .select(
        'id, title, description, difficulty, deck, egos, tags, lang, vote_count, view_count, comment_count, created_at, user_id, profiles:user_id(username, avatar_url)',
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
  const { initialPlans, initialTotal } = await getCachedInitialPlans(lang)

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden" style={{ background: 'var(--bg-deep)' }}>
      <div className="w-full max-w-7xl mx-auto shrink-0" style={{ padding: '6.5rem 1.5rem 1.25rem' }}>
        <p
          suppressHydrationWarning
          style={{
            color: 'var(--gold-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.625rem',
            letterSpacing: '0.3em',
            marginBottom: '0.5rem',
          }}
        >
          {t('eyebrow')}
        </p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold" suppressHydrationWarning style={{ color: 'var(--gold)' }}>
              {t('title')}
            </h1>
            <p style={{ color: '#888888', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
              {t('subtitle')}
            </p>
          </div>
          <Link
            href="/planner"
            className="flex shrink-0 items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95"
            style={{ background: 'var(--gold)', color: 'var(--bg-deep)', borderRadius: '4px', fontFamily: 'var(--font-heading)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {t('newPlan')}
          </Link>
        </div>
        <div suppressHydrationWarning style={{ width: '8rem', height: '0.0625rem', background: 'linear-gradient(90deg, var(--gold), transparent)', marginTop: '1rem', transformOrigin: 'left' }} />
      </div>
      <Suspense fallback={<CommunityPageSkeleton />}>
        <CommunityClient initialPlans={initialPlans} initialTotal={initialTotal} />
      </Suspense>
    </div>
  )
}

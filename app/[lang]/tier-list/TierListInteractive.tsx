'use client'

import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useMemo } from 'react'
import type { TierIdentity } from './TierCardInteractive'
import { getTierCategoryLabel, TIER_CATEGORIES, type RatingPeriod, type TierCategory, type Tier, type TierRatingViewer } from './TierRatingModal'
import { motion } from 'framer-motion'
import ScrollReveal from '@/components/ui/ScrollReveal'
import { fadeInUp } from '@/lib/animations'
import TierGrid from './TierGrid'

const TIERS: Tier[] = ['S+', 'S', 'A', 'B', 'C', 'N/A']
type TierData = Record<Tier, TierIdentity[]>
type SupportedLocale = 'ko' | 'en' | 'ja'
const PERIOD_OPTIONS: RatingPeriod[] = ['7d', '30d', '1y', 'all']

const PERIOD_LABELS: Record<SupportedLocale, Record<RatingPeriod, string>> = {
  ko: { '7d': '7일', '30d': '30일', '1y': '1년', all: '전체' },
  en: { '7d': '7D', '30d': '30D', '1y': '1Y', all: 'All' },
  ja: { '7d': '7日', '30d': '30日', '1y': '1年', all: '全期間' },
}

function normalizeLocale(locale: string): SupportedLocale {
  return locale === 'en' || locale === 'ja' ? locale : 'ko'
}

function getTierListHref(locale: SupportedLocale, category: TierCategory, period: RatingPeriod) {
  const params = new URLSearchParams()
  if (category !== 'overall') params.set('category', category)
  if (period !== 'all') params.set('period', period)
  const query = params.toString()
  return query ? `/${locale}/tier-list?${query}` : `/${locale}/tier-list`
}

export default function TierListInteractive({
  tiers,
  category,
  period,
  viewer,
}: {
  tiers: TierData
  category: TierCategory
  period: RatingPeriod
  viewer: TierRatingViewer
}) {
  const locale = normalizeLocale(useLocale())
  const hasTiers = TIERS.some(t => tiers[t].length > 0)
  const activeCategoryLabel = getTierCategoryLabel(category, locale)
  const motionKey = useMemo(() => `${category}:${period}`, [category, period])

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 pb-16" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <ScrollReveal variant={fadeInUp} as="div">
          <div className="mb-5">
            <div
              className="mx-auto flex w-full max-w-lg items-center"
              style={{
                padding: '0.25rem',
                background: '#14100c',
                border: '1px solid rgba(200,144,10,0.22)',
                borderRadius: '0.5rem',
              }}
            >
              {TIER_CATEGORIES.map(item => {
                const selected = category === item.key
                return (
                  <Link
                    key={item.key}
                    href={getTierListHref(locale, item.key, period)}
                    aria-current={selected ? 'page' : undefined}
                    data-tier-tab={item.key}
                    scroll={false}
                    prefetch={false}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '2.25rem',
                      borderRadius: '0.375rem',
                      background: selected ? 'rgba(200,144,10,0.18)' : 'transparent',
                      border: selected ? '1px solid rgba(200,144,10,0.35)' : '1px solid transparent',
                      color: selected ? 'var(--gold)' : '#8a7855',
                      fontSize: '0.875rem',
                      fontWeight: selected ? 700 : 500,
                      cursor: 'pointer',
                      textDecoration: 'none',
                      transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                    }}
                  >
                    {getTierCategoryLabel(item.key, locale)}
                  </Link>
                )
              })}
            </div>
            <div
              className="mx-auto mt-2.5 flex w-full max-w-lg items-center justify-center gap-1.5 overflow-x-auto"
              style={{
                padding: '0.0625rem 0.125rem 0.1875rem',
                background: 'transparent',
                border: 0,
                scrollbarWidth: 'none',
              }}
            >
              {PERIOD_OPTIONS.map(item => {
                const selected = period === item
                return (
                  <Link
                    key={item}
                    href={getTierListHref(locale, category, item)}
                    aria-current={selected ? 'true' : undefined}
                    scroll={false}
                    prefetch={false}
                    style={{
                      flex: '0 0 auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '1.625rem',
                      borderRadius: '999rem',
                      background: selected ? 'rgba(200,144,10,0.12)' : 'rgba(13,11,8,0.24)',
                      border: selected ? '1px solid rgba(200,144,10,0.34)' : '1px solid rgba(138,120,85,0.18)',
                      color: selected ? '#d8b04a' : '#8a7855',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.6875rem',
                      fontWeight: selected ? 800 : 600,
                      padding: '0 0.625rem',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {PERIOD_LABELS[locale][item]}
                  </Link>
                )
              })}
            </div>
          </div>
        </ScrollReveal>

        {!hasTiers ? (
          <div
            className="text-center"
            style={{
              padding: '3rem 1rem',
              background: '#14100c',
              border: '1px dashed rgba(200,144,10,0.24)',
              borderRadius: '0.5rem',
            }}
          >
            <p style={{ color: 'var(--gold)', fontSize: '0.875rem', fontWeight: 700 }}>
              {activeCategoryLabel}
            </p>
            <p style={{ color: '#888888', fontSize: '0.875rem', marginTop: '0.375rem' }}>
              측정 대상 인격을 불러오지 못했습니다.
            </p>
          </div>
        ) : (
          <>
            <motion.div
              key={motionKey}
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
              }}
            >
              <TierGrid tiers={tiers} category={category} period={period} viewer={viewer} />
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}

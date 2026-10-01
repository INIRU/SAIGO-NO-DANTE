'use client'

import BoardSkeleton from '@/components/discovery/BoardSkeleton'
import { memo } from 'react'
import { Link } from '@/lib/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import DeckCard, { type DeckSummary } from '@/components/decks/DeckCard'
import type { SupportedLang } from '@/lib/i18n'
import { workbenchReveal } from '@/lib/animations'

interface DeckGridProps {
  filtered: DeckSummary[]
  loading: boolean
  hasMore: boolean
  loadingMore: boolean
  hasAnyFilter: boolean
  sentinelRef: React.Ref<HTMLDivElement>
  onTagClick: (tag: string) => void
}

function DeckGrid({
  filtered,
  loading,
  hasMore,
  loadingMore,
  hasAnyFilter,
  sentinelRef,
  onTagClick,
}: DeckGridProps) {
  const t = useTranslations('decks')
  const locale = useLocale() as SupportedLang
  const shouldReduceMotion = useReducedMotion()
  if (loading) return <BoardSkeleton />

  if (filtered.length === 0) {
    return (
      <m.div
        className="flex flex-col items-center justify-center py-32 gap-4"
        initial={shouldReduceMotion ? false : 'initial'}
        animate="animate"
        variants={shouldReduceMotion ? undefined : workbenchReveal}
      >
        <div style={{ color: '#5a5065', fontSize: '3rem' }}>⊘</div>
        <p className="font-serif text-base" style={{ color: '#555570' }}>
          {hasAnyFilter ? t('grid.noResults') : t('grid.empty')}
        </p>
        {!hasAnyFilter && (
          <Link
            href="/decks/new"
            locale={locale}
            style={{ color: 'var(--gold-dim)', fontSize: '0.8125rem' }}
            className="hover:text-yellow-300 transition-colors underline underline-offset-2"
          >
            {t('grid.createFirst')}
          </Link>
        )}
      </m.div>
    )
  }

  return (
    <>
      <m.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        style={{ position: 'relative', zIndex: 0 }}
        initial={false}
      >
        {filtered.map(deck => (
          <m.div
            key={deck.id}
            className="h-full"
            initial={false}
            whileHover={shouldReduceMotion ? undefined : { y: -2 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.6 }}
          >
            <DeckCard deck={deck} onTagClick={onTagClick} />
          </m.div>
        ))}
      </m.div>

      {/* 무한 스크롤 센티널 */}
      {hasMore && (
        <m.div
          ref={sentinelRef}
          className="flex justify-center py-8"
          initial={shouldReduceMotion ? false : 'initial'}
          whileInView={shouldReduceMotion ? undefined : 'animate'}
          viewport={shouldReduceMotion ? undefined : { once: true, margin: '-48px' }}
          variants={shouldReduceMotion ? undefined : workbenchReveal}
        >
          {loadingMore && (
            <BoardSkeleton count={3} />
          )}
        </m.div>
      )}
    </>
  )
}

export default memo(DeckGrid)

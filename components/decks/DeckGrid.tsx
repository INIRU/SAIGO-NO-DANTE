'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import DeckCard, { type DeckSummary } from '@/components/decks/DeckCard'
import { staggerContainer, staggerItem } from '@/lib/animations'

interface DeckGridProps {
  filtered: DeckSummary[]
  loading: boolean
  hasMore: boolean
  loadingMore: boolean
  hasAnyFilter: boolean
  sentinelRef: React.RefObject<HTMLDivElement | null>
  onTagClick: (tag: string) => void
}

export default function DeckGrid({
  filtered,
  loading,
  hasMore,
  loadingMore,
  hasAnyFilter,
  sentinelRef,
  onTagClick,
}: DeckGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded"
            style={{ background: '#1a1510', border: '1px solid var(--border)', height: '10rem', opacity: 0.4 + i * 0.05 }}
          >
            <div style={{ padding: '1.25rem' }}>
              <div style={{ width: '60%', height: '0.875rem', background: '#2a2015', borderRadius: '0.125rem', marginBottom: '0.625rem' }} />
              <div style={{ width: '90%', height: '0.625rem', background: '#2a2015', borderRadius: '0.125rem', marginBottom: '0.375rem' }} />
              <div style={{ width: '70%', height: '0.625rem', background: '#2a2015', borderRadius: '0.125rem' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div style={{ color: '#5a5065', fontSize: '3rem' }}>⊘</div>
        <p className="font-serif text-base" style={{ color: '#555570' }}>
          {hasAnyFilter ? '검색 결과가 없습니다.' : '아직 등록된 덱이 없습니다.'}
        </p>
        {!hasAnyFilter && (
          <Link
            href="/decks/new"
            style={{ color: 'var(--gold-dim)', fontSize: '0.8125rem' }}
            className="hover:text-yellow-300 transition-colors underline underline-offset-2"
          >
            첫 번째 덱을 만들어보세요 →
          </Link>
        )}
      </div>
    )
  }

  return (
    <>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        style={{ position: 'relative', zIndex: 0 }}
        variants={staggerContainer(0.06)}
        initial="initial"
        animate="animate"
      >
        {filtered.map(deck => (
          <motion.div key={deck.id} variants={staggerItem} className="cv-card-lg">
            <DeckCard deck={deck} onTagClick={onTagClick} />
          </motion.div>
        ))}
      </motion.div>

      {/* 무한 스크롤 센티널 */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {loadingMore && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#888888' }}>
              <div
                className="rounded-full animate-spin"
                style={{ width: '1rem', height: '1rem', border: '2px solid var(--border)', borderTopColor: 'var(--gold)' }}
              />
              불러오는 중...
            </div>
          )}
        </div>
      )}
    </>
  )
}

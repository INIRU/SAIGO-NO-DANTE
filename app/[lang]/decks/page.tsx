import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife } from 'next/cache'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import DecksClient from './DecksClient'
import type { DeckSummary } from '@/components/decks/DeckCard'

export const metadata: Metadata = {
  title: '덱 게시판',
  description: '림버스 컴퍼니 커뮤니티 덱 빌드를 탐색하고 공유하세요.',
  alternates: { canonical: 'https://saigo-no-dante.com/decks' },
}

const PAGE_SIZE = 12

function DecksPageSkeleton() {
  return (
    <div className="animate-pulse" style={{ minHeight: '60vh', padding: '2rem 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))', gap: '1rem' }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: '#1a1510',
              borderRadius: '0.5rem',
              height: '12rem',
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default async function DecksPage() {
  'use cache'
  cacheLife('page-1m')
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .schema('limbus')
    .from('decks')
    .select(`
      id, title, description, tags, content_type, vote_count, view_count, comment_count, created_at,
      profiles!decks_user_id_fkey(username),
      deck_identities(slot_order, gacksung, s1_count, s2_count, s3_count, identities(id, sinner_id, folder_name, game_id, keywords, name_kr)),
      deck_egos(ego_id)
    `)
    .order('created_at', { ascending: false })
    .range(0, PAGE_SIZE - 1)

  if (error) {
    console.error('[DecksPage] initial fetch error:', error)
  }

  const initialDecks = (data ?? []).map(d => {
    const profiles = d.profiles as { username?: string } | { username?: string }[] | null
    const username = Array.isArray(profiles)
      ? (profiles[0]?.username ?? undefined)
      : (profiles?.username ?? undefined)
    return { ...d, profiles: undefined, username } as unknown as DeckSummary
  })

  return (
    <div style={{ background: 'var(--bg-deep)', minHeight: '100dvh' }}>
      {/* Server-rendered header — instant paint */}
      <div className="max-w-7xl mx-auto" style={{ padding: '7rem 1.5rem 2rem' }}>
        <p className="decks-header-tag" suppressHydrationWarning style={{ color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.3em', marginBottom: '0.5rem' }}>DECK BOARD</p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="decks-header-title font-serif text-3xl font-bold" suppressHydrationWarning style={{ color: 'var(--gold)' }}>
              덱 게시판
            </h1>
            <p style={{ color: '#888888', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
              림버스 컴퍼니 커뮤니티 덱 빌드를 탐색하고 공유하세요.
            </p>
          </div>
          <Link
            href="/decks/new"
            className="flex items-center gap-2 px-5 py-2.5 font-medium text-sm transition-all duration-200 hover:brightness-110 active:scale-95 shrink-0"
            style={{ background: 'var(--gold)', color: 'var(--bg-deep)', borderRadius: '4px', fontFamily: 'var(--font-heading)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            새 덱 만들기
          </Link>
        </div>
        <div className="decks-header-line" suppressHydrationWarning style={{ width: '8rem', height: '0.0625rem', background: 'linear-gradient(90deg, var(--gold), transparent)', marginTop: '1rem', transformOrigin: 'left' }} />
      </div>
      {/* Client component — streams in with search/filter state from nuqs */}
      <Suspense fallback={
        <div className="max-w-7xl mx-auto" style={{ padding: '0 1.5rem 4rem' }}>
          <DecksPageSkeleton />
        </div>
      }>
        <DecksClient initialDecks={initialDecks} initialTotal={initialDecks.length} />
      </Suspense>
    </div>
  )
}

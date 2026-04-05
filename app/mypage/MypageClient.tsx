'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { showSuccess, showError } from '@/lib/toast'
import MypageTabs, { type MypageTab } from './components/MypageTabs'
import ProfileTab from './components/ProfileTab'
import DecksTab from './components/DecksTab'
import PlannerTab from './components/PlannerTab'
import CollectionTab from './components/CollectionTab'
import { DeckSummary } from '@/components/decks/DeckCard'

// Design Ref: §2 — Option C Pragmatic Balance, 탭 컨테이너

type Profile = {
  username: string | null
  collection_code: string | null
  bio: string | null
  avatar_url: string | null
  created_at: string | null
}

type Stats = {
  deckCount: number
  planCount: number
  bookmarkCount: number
  totalVotesReceived: number
}

type ProfileData = {
  profile: Profile
  decks: DeckSummary[]
  bookmarkedDecks: DeckSummary[]
  email: string
  stats: Stats
}

function resolveInitialTab(searchParams: URLSearchParams): MypageTab {
  const param = searchParams.get('tab')
  if (param && ['profile', 'decks', 'planner', 'collection'].includes(param)) return param as MypageTab
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('mypage-tab')
    if (saved && ['profile', 'decks', 'planner', 'collection'].includes(saved)) return saved as MypageTab
  }
  return 'profile'
}

export default function MypageClient() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<MypageTab>(() => resolveInitialTab(searchParams))

  // SWR: 프로필 로드 (인증 시에만)
  const { data, isLoading: loading, mutate } = useSWR<ProfileData>(
    status === 'authenticated' ? '/api/profile' : null,
    { onError: () => showError('프로필을 불러올 수 없습니다.') },
  )

  // 미인증 리다이렉트
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  // Plan SC: SC-01 — 탭 전환 + URL 동기화
  const handleTabChange = useCallback((tab: MypageTab) => {
    setActiveTab(tab)
    router.replace(`/mypage?tab=${tab}`, { scroll: false })
    localStorage.setItem('mypage-tab', tab)

    // 탭 전환 애니메이션
    const { animate } = require('framer-motion')
    animate('.mypage-panel', { opacity: [0, 1], y: [8, 0] }, { duration: 0.3, ease: 'easeOut' })
  }, [router])

  // 초기 진입 애니메이션
  const animPlayed = useRef(false)
  useEffect(() => {
    if (loading || !data || animPlayed.current) return
    animPlayed.current = true
    const { animate } = require('framer-motion')
    const c1 = animate('.mypage-header', { opacity: [0, 1], y: [-20, 0] }, { duration: 0.7, ease: [0.33, 1, 0.68, 1] })
    const c2 = animate('.mypage-tabs', { opacity: [0, 1], y: [10, 0] }, { duration: 0.4, delay: 0.15, ease: 'easeOut' })
    const c3 = animate('.mypage-panel', { opacity: [0, 1], y: [15, 0] }, { duration: 0.4, delay: 0.25, ease: 'easeOut' })
    return () => { c1.stop(); c2.stop(); c3.stop() }
  }, [loading, data])

  // 덱 삭제
  const deleteDeck = useCallback(async (deckId: string) => {
    try {
      const res = await fetch(`/api/decks/${deckId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        showError(err.error ?? '삭제에 실패했습니다.')
        return
      }
      mutate(prev => prev ? { ...prev, decks: prev.decks.filter(d => d.id !== deckId) } : prev, false)
      showSuccess('덱이 삭제되었습니다.')
    } catch {
      showError('삭제에 실패했습니다.')
    }
  }, [])

  // 북마크 해제
  const removeBookmark = useCallback(async (deckId: string) => {
    try {
      const res = await fetch(`/api/decks/${deckId}/bookmark`, { method: 'POST' })
      if (res.ok) {
        mutate(prev => prev ? { ...prev, bookmarkedDecks: prev.bookmarkedDecks.filter(d => d.id !== deckId) } : prev, false)
        showSuccess('북마크가 해제되었습니다.')
      }
    } catch {
      showError('북마크 해제에 실패했습니다.')
    }
  }, [])

  // 프로필 업데이트 콜백
  const handleProfileUpdate = useCallback((updates: Partial<Profile>) => {
    mutate(prev => prev ? { ...prev, profile: { ...prev.profile, ...updates } } : prev, false)
  }, [])

  // 로딩 스켈레톤
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <div style={{ width: '5rem', height: '0.625rem', background: '#2a2015', borderRadius: '0.125rem', marginBottom: '0.5rem' }} />
            <div style={{ width: '11.25rem', height: '2rem', background: '#2a2015', borderRadius: '0.25rem' }} />
          </div>
          <div style={{ background: '#1a1510', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.25rem', marginBottom: '1.5rem' }}>
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ width: '5rem', height: '2.25rem', background: '#2a2015', borderRadius: '0.375rem', opacity: 0.4 + i * 0.1 }} />
              ))}
            </div>
          </div>
          <div style={{ background: '#1a1510', border: '1px solid var(--border)', borderRadius: '0.5rem', height: '12rem' }} />
        </div>
      </div>
    )
  }

  if (!session?.user || !data) return null

  const { profile, email } = data
  const displayName = profile.username ?? session.user.name ?? email

  return (
    <div className="min-h-screen pt-24 pb-16 px-6" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background atmospheric glow */}
      <div style={{
        position: 'fixed', top: '-10rem', right: '-5rem',
        width: '35rem', height: '35rem', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,144,10,0.04) 0%, rgba(200,144,10,0.015) 40%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div className="max-w-5xl mx-auto">
        {/* 섹션 헤더 */}
        <div className="mypage-header mb-8" style={{ opacity: 0 }}>
          <p style={{ color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.3em', marginBottom: '0.5rem' }}>
            MY PAGE
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold" style={{ color: 'var(--gold)' }}>
            마이 페이지
          </h1>
          <div style={{ width: '8rem', height: '0.0625rem', background: 'linear-gradient(90deg, var(--gold), transparent)', marginTop: '1rem' }} />
        </div>

        {/* Plan SC: SC-01 — 4탭 네비게이션 */}
        <div className="mb-6">
          <MypageTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            counts={{ deckCount: data.stats.deckCount, planCount: data.stats.planCount }}
          />
        </div>

        {/* 탭 패널 */}
        <div
          className="mypage-panel"
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          style={{ opacity: 0 }}
        >
          {activeTab === 'profile' && (
            <ProfileTab
              profile={profile}
              email={email}
              displayName={displayName}
              stats={data.stats}
              onProfileUpdate={handleProfileUpdate}
            />
          )}

          {activeTab === 'decks' && (
            <DecksTab
              decks={data.decks}
              bookmarkedDecks={data.bookmarkedDecks}
              onDeleteDeck={deleteDeck}
              onRemoveBookmark={removeBookmark}
            />
          )}

          {activeTab === 'planner' && (
            <PlannerTab />
          )}

          {activeTab === 'collection' && (
            <CollectionTab savedCode={profile.collection_code} />
          )}
        </div>
      </div>

    </div>
  )
}

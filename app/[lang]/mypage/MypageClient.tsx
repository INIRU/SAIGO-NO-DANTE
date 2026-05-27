'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import Image from 'next/image'
import { showSuccess, showError } from '@/lib/toast'
import MypageTabs, { type MypageTab } from './components/MypageTabs'
import ProfileTab from './components/ProfileTab'
import DecksTab from './components/DecksTab'
import PlannerTab from './components/PlannerTab'
import CollectionTab from './components/CollectionTab'
import { DeckSummary } from '@/components/decks/DeckCard'
import LocalTime from '@/components/ui/LocalTime'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import { Archive, Bookmark, Calendar, Layers, Map, Plus } from 'lucide-react'

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

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function MypageClient() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [entryOpacity, setEntryOpacity] = useState(() => prefersReducedMotion() ? 1 : 0)

  const [activeTab, setActiveTab] = useState<MypageTab>(() => {
    const param = searchParams?.get('tab')
    if (param && ['profile', 'decks', 'planner', 'collection'].includes(param)) return param as MypageTab
    return 'profile'
  })

  useEffect(() => {
    const saved = localStorage.getItem('mypage-tab')
    if (saved && ['profile', 'decks', 'planner', 'collection'].includes(saved)) {
      setActiveTab(saved as MypageTab)
    }
  }, [])

  const setEntryElementsOpacity = useCallback((opacity: 0 | 1) => {
    document.querySelectorAll<HTMLElement>('.mypage-header, .mypage-tabs, .mypage-panel').forEach((element) => {
      element.style.opacity = String(opacity)
    })
  }, [])

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

    if (prefersReducedMotion()) {
      setEntryOpacity(1)
      requestAnimationFrame(() => setEntryElementsOpacity(1))
      return
    }
    void import('motion/react').then(({ animate }) => {
      animate('.mypage-panel', { opacity: [0, 1], y: [8, 0] }, { duration: 0.3, ease: 'easeOut' })
    })
  }, [router, setEntryElementsOpacity])

  // 초기 진입 애니메이션
  const animPlayed = useRef(false)
  useEffect(() => {
    if (loading || !data || animPlayed.current) return
    if (prefersReducedMotion()) {
      animPlayed.current = true
      setEntryOpacity(1)
      setEntryElementsOpacity(1)
      return
    }
    animPlayed.current = true
    let controls: Array<{ stop: () => void }> = []
    let cancelled = false
    void import('motion/react').then(({ animate }) => {
      if (cancelled) return
      controls = [
        animate('.mypage-header', { opacity: [0, 1], y: [-20, 0] }, { duration: 0.7, ease: [0.33, 1, 0.68, 1] }),
        animate('.mypage-tabs', { opacity: [0, 1], y: [10, 0] }, { duration: 0.4, delay: 0.15, ease: 'easeOut' }),
        animate('.mypage-panel', { opacity: [0, 1], y: [15, 0] }, { duration: 0.4, delay: 0.25, ease: 'easeOut' }),
      ]
    })
    return () => {
      cancelled = true
      controls.forEach(control => control.stop())
    }
  }, [loading, data, setEntryElementsOpacity])

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
      <div className="min-h-[100dvh] px-4 pb-16 pt-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 rounded-lg border border-[rgba(200,144,10,0.14)] bg-[#120e09] p-4 sm:p-5">
            <div style={{ width: '9rem', height: '1rem', background: '#2a2015', borderRadius: '0.125rem', marginBottom: '0.75rem' }} />
            <div style={{ width: '16rem', maxWidth: '80%', height: '2.5rem', background: '#2a2015', borderRadius: '0.25rem' }} />
          </div>
          <div style={{ background: '#1a1510', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.25rem', marginBottom: '1rem' }}>
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ width: '6rem', height: '2.75rem', background: '#2a2015', borderRadius: '0.375rem', opacity: 0.4 + i * 0.1 }} />
              ))}
            </div>
          </div>
          <div style={{ background: '#1a1510', border: '1px solid var(--border)', borderRadius: '0.5rem', height: '18rem' }} />
        </div>
      </div>
    )
  }

  if (!session?.user || !data) return null

  const { profile, email } = data
  const displayName = profile.username ?? session.user.name ?? email
  const avatarUrl = profile.avatar_url || DEFAULT_AVATAR_URL
  const currentTabLabel = activeTab === 'profile' ? '프로필' : activeTab === 'decks' ? '덱' : activeTab === 'planner' ? '플래너' : '컬렉션'
  const statItems = [
    { label: '덱', value: data.stats.deckCount, icon: Layers, tab: 'decks' as const },
    { label: '플랜', value: data.stats.planCount, icon: Map, tab: 'planner' as const },
    { label: '북마크', value: data.stats.bookmarkCount, icon: Bookmark, tab: 'decks' as const },
    { label: '받은 추천', value: data.stats.totalVotesReceived, icon: Archive, tab: 'profile' as const },
  ]

  return (
    <div className="min-h-[100dvh] px-4 pb-16 pt-24 sm:px-6" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="mx-auto max-w-6xl">
        <section
          className="mypage-header mb-4 grid gap-4 rounded-lg border border-[rgba(200,144,10,0.16)] bg-[#120e09]/90 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto]"
          style={{ opacity: entryOpacity }}
        >
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative h-16 w-16 flex-none overflow-hidden rounded-md border border-[rgba(200,144,10,0.35)] bg-[#1a1510] sm:h-20 sm:w-20">
              <Image src={avatarUrl} alt="" fill sizes="80px" className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[0.875rem]" style={{ color: 'var(--gold-dim)' }}>MY PAGE</p>
              <h1 className="mt-1 break-words font-serif text-[2rem] leading-tight sm:text-[2.5rem]" style={{ color: 'var(--gold)' }}>
                {displayName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                <span className="min-w-0 break-all">{email}</span>
                {profile.created_at && (
                  <span className="inline-flex items-center gap-1.5 font-mono">
                    <Calendar size={14} aria-hidden="true" />
                    <LocalTime value={profile.created_at} locale="ko-KR" dateStyle="medium" />
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[26rem]">
            {statItems.map(({ label, value, icon: Icon, tab }) => (
              <button
                key={label}
                type="button"
                onClick={() => handleTabChange(tab)}
                className="min-h-16 rounded-md border border-[rgba(200,144,10,0.12)] bg-[#1a1510] px-3 py-2 text-left transition-colors hover:border-[rgba(200,144,10,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
              >
                <span className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                  <Icon size={15} aria-hidden="true" />
                  {label}
                </span>
                <span className="mt-1 block font-mono text-[1.375rem] leading-none" style={{ color: 'var(--gold)' }}>{value}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[0.875rem]" style={{ color: 'var(--text-tertiary)' }}>{currentTabLabel}</p>
          <Link
            href="/decks/new"
            className="inline-flex min-h-11 items-center gap-2 rounded bg-[var(--gold)] px-4 font-heading text-[0.9375rem] font-semibold text-[var(--bg-deep)] transition hover:brightness-110 active:scale-[0.98]"
          >
            <Plus size={16} aria-hidden="true" />
            새 덱
          </Link>
        </div>

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
          style={{ opacity: entryOpacity }}
        >
          {activeTab === 'profile' && (
            <ProfileTab
              profile={profile}
              email={email}
              displayName={displayName}
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

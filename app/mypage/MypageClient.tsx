'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import DeckCard, { DeckSummary } from '@/components/decks/DeckCard'
import CollectionSection from '@/components/mypage/CollectionSection'
import AvatarPicker, { AvatarEditOverlay } from '@/components/mypage/AvatarPicker'
import { Pencil, Trash2, Calendar, X, Check, Plus, LogOut, Bookmark } from 'lucide-react'
import { useToast, Toast } from '@/components/ui/Toast'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'

type Profile = {
  username: string | null
  collection_code: string | null
  bio: string | null
  avatar_url: string | null
  created_at: string | null
}

type ProfileData = {
  profile: Profile
  decks: DeckSummary[]
  bookmarkedDecks: DeckSummary[]
  email: string
}

export default function MypageClient() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  // 닉네임 편집
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  // bio 편집
  const [editingBio, setEditingBio] = useState(false)
  const [bioValue, setBioValue] = useState('')
  const [bioSaving, setBioSaving] = useState(false)

  // 토스트
  const { toast, showToast } = useToast()

  // 삭제 확인
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 탈퇴
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  // 아바타 피커
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)

  const handleAvatarSelect = async (url: string) => {
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: url }),
      })
      if (!res.ok) {
        showToast('프로필 사진 변경에 실패했습니다.')
        return
      }
      setData(prev => prev ? { ...prev, profile: { ...prev.profile, avatar_url: url } } : prev)
      setAvatarPickerOpen(false)
      showToast('프로필 사진이 변경되었습니다.', 'success')
      window.dispatchEvent(new CustomEvent('avatar-changed', { detail: url }))
    } catch {
      showToast('프로필 사진 변경에 실패했습니다.')
    }
  }

  const handleAvatarReset = async () => {
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: DEFAULT_AVATAR_URL }),
      })
      if (!res.ok) {
        showToast('프로필 사진 초기화에 실패했습니다.')
        return
      }
      setData(prev => prev ? { ...prev, profile: { ...prev.profile, avatar_url: DEFAULT_AVATAR_URL } } : prev)
      setAvatarPickerOpen(false)
      showToast('프로필 사진이 초기화되었습니다.', 'success')
      window.dispatchEvent(new CustomEvent('avatar-changed', { detail: null }))
    } catch {
      showToast('프로필 사진 초기화에 실패했습니다.')
    }
  }


  // 미인증 리다이렉트
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // 프로필 로드
  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/profile')
      .then(r => r.json())
      .then((d: ProfileData) => {
        setData(d)
        setNameValue(d.profile.username ?? '')
        setBioValue(d.profile.bio ?? '')
      })
      .catch(() => showToast('프로필을 불러올 수 없습니다.'))
      .finally(() => setLoading(false))
  }, [status, showToast])

  // GSAP 입장 애니메이션 (DOM 렌더 후 1회만 실행)
  const animPlayed = useRef(false)
  useEffect(() => {
    if (loading || !data || animPlayed.current) return
    animPlayed.current = true
    import('gsap').then(({ gsap }) => {
      gsap.fromTo('.mypage-header',
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }
      )
      gsap.fromTo('.mypage-sidebar',
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.5, delay: 0.15, ease: 'power2.out' }
      )
      gsap.fromTo('.mypage-content',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, delay: 0.25, ease: 'power2.out' }
      )
    })
  }, [loading, data])

  // 닉네임 저장
  const saveName = async () => {
    if (!nameValue.trim()) return
    setNameSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: nameValue }),
      })
      if (!res.ok) {
        const err = await res.json()
        showToast(err.error ?? '저장에 실패했습니다.')
        return
      }
      setData(prev => prev ? { ...prev, profile: { ...prev.profile, username: nameValue.trim() } } : prev)
      setEditingName(false)
      showToast('닉네임이 변경되었습니다.', 'success')
    } catch {
      showToast('저장에 실패했습니다.')
    } finally {
      setNameSaving(false)
    }
  }

  // bio 저장
  const saveBio = async () => {
    setBioSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bioValue }),
      })
      if (!res.ok) {
        const err = await res.json()
        showToast(err.error ?? '저장에 실패했습니다.')
        return
      }
      setData(prev => prev ? { ...prev, profile: { ...prev.profile, bio: bioValue } } : prev)
      setEditingBio(false)
      showToast('소개가 변경되었습니다.', 'success')
    } catch {
      showToast('저장에 실패했습니다.')
    } finally {
      setBioSaving(false)
    }
  }

  // 덱 삭제
  const deleteDeck = async (deckId: string) => {
    try {
      const res = await fetch(`/api/decks/${deckId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        showToast(err.error ?? '삭제에 실패했습니다.')
        return
      }
      setData(prev => prev ? { ...prev, decks: prev.decks.filter(d => d.id !== deckId) } : prev)
      showToast('덱이 삭제되었습니다.', 'success')
    } catch {
      showToast('삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  // 회원 탈퇴
  const withdrawAccount = async () => {
    setWithdrawing(true)
    try {
      const res = await fetch('/api/profile', { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        showToast(err.error ?? '탈퇴에 실패했습니다.')
        return
      }
      await signOut({ callbackUrl: '/' })
    } catch {
      showToast('탈퇴에 실패했습니다.')
    } finally {
      setWithdrawing(false)
      setShowWithdraw(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <div style={{ width: 80, height: 10, background: '#2a2015', borderRadius: 2, marginBottom: 8 }} />
            <div style={{ width: 180, height: 32, background: '#2a2015', borderRadius: 4 }} />
          </div>
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-72 flex-shrink-0">
              <div style={{ background: '#1a1510', border: '1px solid var(--border)', borderRadius: 8, padding: 24 }}>
                <div className="flex flex-col items-center gap-4">
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#2a2015' }} />
                  <div style={{ width: 120, height: 16, background: '#2a2015', borderRadius: 2 }} />
                  <div style={{ width: 160, height: 10, background: '#2a2015', borderRadius: 2 }} />
                </div>
              </div>
            </div>
            <div className="flex-1">
              <div style={{ background: '#1a1510', border: '1px solid var(--border)', borderRadius: 8, padding: 24, marginBottom: 24 }}>
                <div style={{ width: 100, height: 14, background: '#2a2015', borderRadius: 2, marginBottom: 16 }} />
                <div style={{ width: '80%', height: 10, background: '#2a2015', borderRadius: 2 }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ background: '#1a1510', border: '1px solid var(--border)', borderRadius: 6, height: 200, opacity: 0.4 + i * 0.1 }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!session?.user || !data) return null

  // 북마크 해제
  const removeBookmark = async (deckId: string) => {
    try {
      const res = await fetch(`/api/decks/${deckId}/bookmark`, { method: 'POST' })
      if (res.ok) {
        setData(prev => prev ? { ...prev, bookmarkedDecks: prev.bookmarkedDecks.filter(d => d.id !== deckId) } : prev)
        showToast('북마크가 해제되었습니다.', 'success')
      }
    } catch {
      showToast('북마크 해제에 실패했습니다.')
    }
  }

  const { profile, decks, email } = data
  const displayName = profile.username ?? session.user.name ?? email
  const avatarUrl = profile.avatar_url || DEFAULT_AVATAR_URL
  const joinDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <div className="min-h-screen pt-24 pb-16 px-6" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background atmospheric glow */}
      <div style={{
        position: 'fixed',
        top: '-10rem',
        right: '-5rem',
        width: '35rem',
        height: '35rem',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,144,10,0.04) 0%, rgba(200,144,10,0.015) 40%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />
      <div className="max-w-6xl mx-auto">

        {/* 섹션 헤더 */}
        <div className="mypage-header mb-10" style={{ opacity: 0 }}>
          <p style={{ color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.3em', marginBottom: '0.5rem' }}>
            MY PAGE
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold" style={{ color: 'var(--gold)' }}>
            마이 페이지
          </h1>
          <div style={{ width: '8rem', height: '0.0625rem', background: 'linear-gradient(90deg, var(--gold), transparent)', marginTop: '1rem' }} />
        </div>

        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── 사이드바 ── */}
          <aside className="mypage-sidebar lg:w-72 flex-shrink-0 lg:sticky lg:top-24 lg:self-start" style={{ opacity: 0 }}>
            <div
              style={{
                background: '#1a1510',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '24px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* 골드 그라디언트 상단 장식선 */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: 'linear-gradient(90deg, transparent, var(--gold), transparent)',
              }} />
              <div className="flex flex-col items-center gap-3">
                {/* 아바타 */}
                <div style={{ position: 'relative', width: 80, height: 80 }}>
                  {avatarUrl ? (
                    <div style={{
                      width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', position: 'relative',
                      border: '2px solid var(--gold-dim)',
                      boxShadow: '0 0 16px rgba(200,144,10,0.35)',
                    }}>
                      <Image src={avatarUrl} alt="" fill sizes="80px" style={{ objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: 'rgba(200,144,10,0.15)',
                        border: '2px solid var(--gold-dim)',
                        boxShadow: '0 0 16px rgba(200,144,10,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--gold)',
                        fontSize: '1.75rem',
                        fontWeight: 'bold',
                      }}
                    >
                      {displayName[0]?.toUpperCase()}
                    </div>
                  )}
                  <AvatarEditOverlay onClick={() => setAvatarPickerOpen(true)} />
                </div>

                {/* 닉네임 */}
                {editingName ? (
                  <div className="flex items-center gap-1.5 w-full">
                    <input
                      value={nameValue}
                      onChange={e => setNameValue(e.target.value)}
                      maxLength={20}
                      autoFocus
                      className="flex-1 px-2 py-1 text-sm outline-none"
                      style={{
                        background: '#120e09',
                        border: '1px solid var(--gold-dim)',
                        borderRadius: '4px',
                        color: '#e8dcc8',
                        fontFamily: 'var(--font-body)',
                        minWidth: 0,
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveName()
                        if (e.key === 'Escape') { setEditingName(false); setNameValue(profile.username ?? '') }
                      }}
                    />
                    <button
                      onClick={saveName}
                      disabled={nameSaving}
                      style={{ color: 'var(--gold)', cursor: 'pointer', padding: 4 }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => { setEditingName(false); setNameValue(profile.username ?? '') }}
                      style={{ color: '#555', cursor: 'pointer', padding: 4 }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span
                      className="font-serif font-light text-lg"
                      style={{ color: '#e8dcc8' }}
                    >
                      {displayName}
                    </span>
                    <button
                      onClick={() => setEditingName(true)}
                      style={{ color: '#555', cursor: 'pointer', padding: 4 }}
                      className="hover:opacity-70 transition-opacity"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                )}

                {/* 이메일 */}
                <p style={{ color: '#6a6080', fontSize: '0.6875rem', wordBreak: 'break-all', textAlign: 'center' }}>
                  {email}
                </p>

                {/* 구분선 */}
                <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, var(--border), transparent)', margin: '4px 0' }} />

                {/* 가입일 */}
                {joinDate && (
                  <div className="flex items-center gap-1.5" style={{ color: '#6a6080', fontSize: '0.6875rem' }}>
                    <Calendar size={12} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem' }}>{joinDate}</span>
                  </div>
                )}

                {/* 구분선 */}
                <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, var(--border), transparent)', margin: '2px 0' }} />

                {/* 덱 수 */}
                <div style={{ color: '#6a6080', fontSize: '0.6875rem' }}>
                  덱 <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>{decks.length}</span>개
                </div>
              </div>
            </div>

            {/* 로그아웃 + 탈퇴 */}
            <div
              style={{
                background: '#1a1510',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '16px',
                marginTop: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {/* 로그아웃 버튼 */}
              {!showWithdraw && (
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="flex items-center gap-2 w-full justify-center transition-all duration-200 hover:opacity-90"
                  style={{
                    color: '#9a8a70',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    padding: '7px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <LogOut size={13} />
                  로그아웃
                </button>
              )}

              {/* 구분선 */}
              {!showWithdraw && (
                <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, var(--border), transparent)' }} />
              )}

              {/* 탈퇴 */}
              {showWithdraw ? (
                <div className="flex flex-col gap-3">
                  <p style={{ color: '#ff6060', fontSize: '0.75rem', lineHeight: 1.6 }}>
                    탈퇴하면 모든 덱과 프로필이 영구 삭제됩니다. 정말 탈퇴하시겠습니까?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowWithdraw(false)}
                      className="flex-1 py-1.5 text-xs"
                      style={{ color: '#888', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 4, transition: 'opacity 0.15s' }}
                    >
                      취소
                    </button>
                    <button
                      onClick={withdrawAccount}
                      disabled={withdrawing}
                      className="flex-1 py-1.5 text-xs font-medium"
                      style={{
                        background: 'rgba(139,26,26,0.9)',
                        color: '#ff6060',
                        borderRadius: 4,
                        cursor: 'pointer',
                        border: '1px solid rgba(139,26,26,0.5)',
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {withdrawing ? '처리 중...' : '탈퇴 확인'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowWithdraw(true)}
                  className="flex items-center gap-1.5 w-full justify-center transition-opacity hover:opacity-80"
                  style={{ color: '#4a3030', fontSize: '0.6875rem', cursor: 'pointer' }}
                >
                  회원 탈퇴
                </button>
              )}
            </div>
          </aside>

          {/* ── 메인 콘텐츠 ── */}
          <main className="mypage-content flex-1 min-w-0" style={{ opacity: 0 }}>

            {/* ABOUT ME */}
            <section
              style={{
                background: '#1a1510',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '24px',
                marginBottom: '24px',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2" style={{ borderLeft: '3px solid var(--gold)', paddingLeft: '10px' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.15em' }}>
                    ABOUT ME
                  </span>
                  <span className="font-serif font-light" style={{ color: 'var(--gold)', fontSize: '1rem' }}>
                    내 소개
                  </span>
                </h2>
                {!editingBio && (
                  <button
                    onClick={() => setEditingBio(true)}
                    style={{ color: '#555', cursor: 'pointer', padding: 4 }}
                    className="hover:opacity-70 transition-opacity"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>

              {editingBio ? (
                <div>
                  <textarea
                    value={bioValue}
                    onChange={e => setBioValue(e.target.value)}
                    maxLength={300}
                    rows={4}
                    autoFocus
                    placeholder="간단한 자기소개를 작성해보세요..."
                    className="w-full px-3 py-2 text-sm outline-none resize-none"
                    style={{
                      background: '#120e09',
                      border: '1px solid var(--gold-dim)',
                      borderRadius: '4px',
                      color: '#e8dcc8',
                      fontFamily: 'var(--font-body)',
                    }}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>
                      {bioValue.length}/300
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingBio(false); setBioValue(profile.bio ?? '') }}
                        className="px-3 py-1 text-xs"
                        style={{ color: '#666', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 4 }}
                      >
                        취소
                      </button>
                      <button
                        onClick={saveBio}
                        disabled={bioSaving}
                        className="px-3 py-1 text-xs font-medium"
                        style={{
                          background: 'var(--gold)',
                          color: 'var(--bg-deep)',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-heading)',
                        }}
                      >
                        저장
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ color: profile.bio ? '#9a8a70' : '#5a5070', fontSize: '0.8125rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {profile.bio || '아직 소개가 없습니다.'}
                </p>
              )}
            </section>

            {/* MY DECKS */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="flex items-center gap-2" style={{ borderLeft: '3px solid var(--gold)', paddingLeft: '10px' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.15em' }}>
                    MY DECKS
                  </span>
                  <span className="font-serif font-light" style={{ color: 'var(--gold)', fontSize: '1rem' }}>
                    내 덱 관리
                  </span>
                </h2>
                <Link
                  href="/decks/new"
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all duration-200 hover:brightness-110 active:scale-95"
                  style={{
                    background: 'var(--gold)',
                    color: 'var(--bg-deep)',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  <Plus size={12} />
                  새 덱
                </Link>
              </div>

              {decks.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-20 gap-4"
                  style={{
                    background: 'linear-gradient(180deg, #1a1510 0%, #120e09 100%)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ color: '#3a2a18', fontSize: '3.5rem', lineHeight: 1, userSelect: 'none' }}>&#x2741;</div>
                  <p className="font-serif text-sm" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-heading)' }}>
                    아직 작성한 덱이 없습니다.
                  </p>
                  <Link
                    href="/decks/new"
                    className="transition-all duration-200 hover:opacity-90"
                    style={{
                      color: 'var(--bg-deep)',
                      background: 'var(--gold)',
                      fontSize: '0.75rem',
                      padding: '6px 16px',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-heading)',
                      cursor: 'pointer',
                    }}
                  >
                    첫 번째 덱 만들기
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {decks.map(deck => (
                    <div key={deck.id} className="relative group/card flex flex-col [&>*:first-child]:flex-1">
                      <DeckCard deck={deck} />

                      {/* 삭제 버튼 오버레이 */}
                      {deletingId === deck.id ? (
                        <div
                          className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
                          style={{
                            background: 'rgba(13,11,8,0.92)',
                            borderRadius: '6px',
                          }}
                        >
                          <p className="text-sm font-serif" style={{ color: '#e8dcc8' }}>
                            이 덱을 삭제할까요?
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setDeletingId(null)}
                              className="px-4 py-1.5 text-xs"
                              style={{ color: '#888', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 4 }}
                            >
                              취소
                            </button>
                            <button
                              onClick={() => deleteDeck(deck.id)}
                              className="px-4 py-1.5 text-xs font-medium"
                              style={{
                                background: 'rgba(139,26,26,0.9)',
                                color: '#ff6060',
                                borderRadius: 4,
                                cursor: 'pointer',
                                border: '1px solid rgba(139,26,26,0.5)',
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(deck.id)}
                          className="absolute top-2 right-2 p-2 rounded opacity-0 group-hover/card:opacity-100 transition-all duration-200 hover:scale-110 z-10"
                          style={{
                            background: 'rgba(139,26,26,0.9)',
                            color: '#ff6060',
                            cursor: 'pointer',
                            border: '1px solid rgba(139,26,26,0.5)',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* BOOKMARKS */}
            <section className="mt-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="flex items-center gap-2" style={{ borderLeft: '3px solid var(--gold)', paddingLeft: '10px' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.15em' }}>
                    BOOKMARKS
                  </span>
                  <span className="font-serif font-light" style={{ color: 'var(--gold)', fontSize: '1rem' }}>
                    저장한 덱
                  </span>
                </h2>
              </div>

              {data.bookmarkedDecks.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-12 gap-3"
                  style={{
                    background: 'linear-gradient(180deg, #1a1510 0%, #120e09 100%)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                >
                  <Bookmark size={22} style={{ color: '#3a3048', strokeWidth: 1.5 }} />
                  <p className="font-serif text-sm" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-heading)' }}>
                    아직 저장한 덱이 없습니다.
                  </p>
                  <Link
                    href="/decks"
                    style={{ color: 'var(--gold-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-body)' }}
                    className="hover:opacity-80 transition-opacity underline underline-offset-2"
                  >
                    덱 게시판 둘러보기 &rarr;
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {data.bookmarkedDecks.map(deck => (
                    <div key={deck.id} className="relative group/card flex flex-col [&>*:first-child]:flex-1">
                      <DeckCard deck={deck} />
                      <button
                        onClick={() => removeBookmark(deck.id)}
                        className="absolute top-2 right-2 p-2 rounded opacity-0 group-hover/card:opacity-100 transition-all duration-200 hover:scale-110 z-10"
                        style={{
                          background: 'rgba(44,28,12,0.9)',
                          color: 'var(--gold-dim)',
                          cursor: 'pointer',
                          border: '1px solid rgba(200,144,10,0.3)',
                        }}
                        title="북마크 해제"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* MY COLLECTION */}
            <section className="mt-8" style={{ borderLeft: '3px solid var(--gold)', paddingLeft: '10px', borderRadius: '0 0 0 2px' }}>
              <Suspense fallback={
                <div style={{ background: '#1a1510', border: '1px solid var(--border)', borderRadius: 8, padding: 24 }}>
                  <div style={{ width: 140, height: 14, background: '#2a2015', borderRadius: 2 }} />
                </div>
              }>
                <CollectionSection savedCode={profile.collection_code} />
              </Suspense>
            </section>
          </main>
        </div>
      </div>

      {/* 아바타 피커 */}
      <AvatarPicker
        open={avatarPickerOpen}
        currentUrl={profile.avatar_url}
        onSelect={handleAvatarSelect}
        onReset={handleAvatarReset}
        onClose={() => setAvatarPickerOpen(false)}
      />

      <Toast toast={toast} />
    </div>
  )
}

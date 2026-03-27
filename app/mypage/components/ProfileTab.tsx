'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Pencil, Calendar, X, Check, LogOut, Layers, Map, Bookmark, Heart } from 'lucide-react'
import { signOut } from 'next-auth/react'
import AvatarPicker, { AvatarEditOverlay } from '@/components/mypage/AvatarPicker'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'

// Design Ref: §5.2 — 프로필 카드 + 통계 + 계정관리

type Stats = {
  deckCount: number
  planCount: number
  bookmarkCount: number
  totalVotesReceived: number
}

type Profile = {
  username: string | null
  collection_code: string | null
  bio: string | null
  avatar_url: string | null
  created_at: string | null
}

type Props = {
  profile: Profile
  email: string
  displayName: string
  stats: Stats
  onProfileUpdate: (updates: Partial<Profile>) => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}

const STAT_ITEMS: { key: keyof Stats; label: string; icon: typeof Layers }[] = [
  { key: 'deckCount', label: '덱', icon: Layers },
  { key: 'planCount', label: '플랜', icon: Map },
  { key: 'bookmarkCount', label: '북마크', icon: Bookmark },
  { key: 'totalVotesReceived', label: '받은 추천', icon: Heart },
]

export default function ProfileTab({ profile, email, displayName, stats, onProfileUpdate, showToast }: Props) {
  // 닉네임 편집
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(profile.username ?? '')
  const [nameSaving, setNameSaving] = useState(false)

  // 바이오 편집
  const [editingBio, setEditingBio] = useState(false)
  const [bioValue, setBioValue] = useState(profile.bio ?? '')
  const [bioSaving, setBioSaving] = useState(false)

  // 아바타 피커
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)

  // 탈퇴
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  const avatarUrl = profile.avatar_url || DEFAULT_AVATAR_URL
  const joinDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

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
      onProfileUpdate({ username: nameValue.trim() })
      setEditingName(false)
      showToast('닉네임이 변경되었습니다.', 'success')
    } catch {
      showToast('저장에 실패했습니다.')
    } finally {
      setNameSaving(false)
    }
  }

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
      onProfileUpdate({ bio: bioValue })
      setEditingBio(false)
      showToast('소개가 변경되었습니다.', 'success')
    } catch {
      showToast('저장에 실패했습니다.')
    } finally {
      setBioSaving(false)
    }
  }

  const handleAvatarSelect = async (url: string) => {
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: url }),
      })
      if (!res.ok) { showToast('프로필 사진 변경에 실패했습니다.'); return }
      onProfileUpdate({ avatar_url: url })
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
      if (!res.ok) { showToast('프로필 사진 초기화에 실패했습니다.'); return }
      onProfileUpdate({ avatar_url: DEFAULT_AVATAR_URL })
      setAvatarPickerOpen(false)
      showToast('프로필 사진이 초기화되었습니다.', 'success')
      window.dispatchEvent(new CustomEvent('avatar-changed', { detail: null }))
    } catch {
      showToast('프로필 사진 초기화에 실패했습니다.')
    }
  }

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

  return (
    <>
      {/* 프로필 카드 */}
      <section
        style={{
          background: '#1a1510',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 골드 상단 장식선 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '0.125rem', background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }} />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* 아바타 */}
          <div style={{ position: 'relative', width: '5rem', height: '5rem', flexShrink: 0 }}>
            <div style={{
              width: '5rem', height: '5rem', borderRadius: '50%', overflow: 'hidden', position: 'relative',
              border: '0.125rem solid var(--gold-dim)',
              boxShadow: '0 0 1rem rgba(200,144,10,0.35)',
            }}>
              <Image src={avatarUrl} alt="" fill sizes="80px" style={{ objectFit: 'cover' }} />
            </div>
            <AvatarEditOverlay onClick={() => setAvatarPickerOpen(true)} />
          </div>

          {/* 정보 */}
          <div className="flex-1 text-center sm:text-left">
            {/* 닉네임 */}
            {editingName ? (
              <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                <input
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  maxLength={20}
                  autoFocus
                  className="px-2 py-1 text-sm outline-none"
                  style={{
                    background: '#120e09', border: '1px solid var(--gold-dim)', borderRadius: '0.25rem',
                    color: '#e8dcc8', fontFamily: 'var(--font-body)', minWidth: 0, maxWidth: '12rem',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveName()
                    if (e.key === 'Escape') { setEditingName(false); setNameValue(profile.username ?? '') }
                  }}
                />
                <button onClick={saveName} disabled={nameSaving} style={{ color: 'var(--gold)', cursor: 'pointer', padding: '0.25rem' }}>
                  <Check size={14} />
                </button>
                <button onClick={() => { setEditingName(false); setNameValue(profile.username ?? '') }} style={{ color: '#555', cursor: 'pointer', padding: '0.25rem' }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                <span className="font-serif font-light text-lg" style={{ color: '#e8dcc8' }}>{displayName}</span>
                <button onClick={() => setEditingName(true)} style={{ color: '#555', cursor: 'pointer', padding: '0.25rem' }} className="hover:opacity-70 transition-opacity">
                  <Pencil size={12} />
                </button>
              </div>
            )}

            <p style={{ color: '#6a6080', fontSize: '0.6875rem', marginTop: '0.25rem' }}>{email}</p>

            {joinDate && (
              <div className="flex items-center gap-1.5 justify-center sm:justify-start mt-1" style={{ color: '#6a6080', fontSize: '0.6875rem' }}>
                <Calendar size={12} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem' }}>{joinDate}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ABOUT ME */}
      <section
        style={{
          background: '#1a1510',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          marginTop: '0.75rem',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2" style={{ borderLeft: '0.1875rem solid var(--gold)', paddingLeft: '0.625rem' }}>
            <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.15em' }}>ABOUT ME</span>
            <span className="font-serif font-light" style={{ color: 'var(--gold)', fontSize: '1rem' }}>내 소개</span>
          </h2>
          {!editingBio && (
            <button onClick={() => setEditingBio(true)} style={{ color: '#555', cursor: 'pointer', padding: '0.25rem' }} className="hover:opacity-70 transition-opacity">
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
              style={{ background: '#120e09', border: '1px solid var(--gold-dim)', borderRadius: '0.25rem', color: '#e8dcc8', fontFamily: 'var(--font-body)' }}
            />
            <div className="flex items-center justify-between mt-2">
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>{bioValue.length}/300</span>
              <div className="flex gap-2">
                <button onClick={() => { setEditingBio(false); setBioValue(profile.bio ?? '') }} className="px-3 py-1 text-xs" style={{ color: '#666', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: '0.25rem' }}>
                  취소
                </button>
                <button onClick={saveBio} disabled={bioSaving} className="px-3 py-1 text-xs font-medium" style={{ background: 'var(--gold)', color: 'var(--bg-deep)', borderRadius: '0.25rem', cursor: 'pointer', fontFamily: 'var(--font-heading)' }}>
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

      {/* Plan SC: SC-05 — 활동 통계 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
        {STAT_ITEMS.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            style={{
              background: '#1a1510',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              padding: '1rem',
              textAlign: 'center',
            }}
          >
            <Icon size={14} style={{ color: 'var(--gold-dim)', margin: '0 auto 0.375rem' }} />
            <div style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.2 }}>
              {stats[key]}
            </div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.6875rem', marginTop: '0.25rem' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 계정 관리 */}
      <div
        style={{
          background: '#1a1510',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginTop: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {!showWithdraw && (
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex items-center gap-2 w-full justify-center transition-all duration-200 hover:opacity-90"
            style={{
              color: '#9a8a70', fontSize: '0.75rem', cursor: 'pointer',
              border: '1px solid var(--border)', borderRadius: '0.25rem',
              padding: '0.4375rem 0.75rem', background: 'rgba(255,255,255,0.03)', fontFamily: 'var(--font-body)',
            }}
          >
            <LogOut size={13} />
            로그아웃
          </button>
        )}

        {!showWithdraw && (
          <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, var(--border), transparent)' }} />
        )}

        {showWithdraw ? (
          <div className="flex flex-col gap-3">
            <p style={{ color: '#ff6060', fontSize: '0.75rem', lineHeight: 1.6 }}>
              탈퇴하면 모든 덱과 프로필이 영구 삭제됩니다. 정말 탈퇴하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowWithdraw(false)} className="flex-1 py-1.5 text-xs" style={{ color: '#888', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: '0.25rem' }}>
                취소
              </button>
              <button onClick={withdrawAccount} disabled={withdrawing} className="flex-1 py-1.5 text-xs font-medium" style={{ background: 'rgba(139,26,26,0.9)', color: '#ff6060', borderRadius: '0.25rem', cursor: 'pointer', border: '1px solid rgba(139,26,26,0.5)' }}>
                {withdrawing ? '처리 중...' : '탈퇴 확인'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowWithdraw(true)} className="flex items-center gap-1.5 w-full justify-center transition-opacity hover:opacity-80" style={{ color: '#4a3030', fontSize: '0.6875rem', cursor: 'pointer' }}>
            회원 탈퇴
          </button>
        )}
      </div>

      {/* 아바타 피커 */}
      <AvatarPicker
        open={avatarPickerOpen}
        currentUrl={profile.avatar_url}
        onSelect={handleAvatarSelect}
        onReset={handleAvatarReset}
        onClose={() => setAvatarPickerOpen(false)}
      />
    </>
  )
}

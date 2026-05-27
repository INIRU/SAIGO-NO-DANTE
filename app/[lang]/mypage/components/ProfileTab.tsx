'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Pencil, Calendar, X, Check, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { showSuccess, showError } from '@/lib/toast'
import AvatarPicker, { AvatarEditOverlay } from '@/components/mypage/AvatarPicker'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import LocalTime from '@/components/ui/LocalTime'

// Design Ref: §5.2 — 프로필 카드 + 통계 + 계정관리

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
  onProfileUpdate: (updates: Partial<Profile>) => void
}

export default function ProfileTab({ profile, email, displayName, onProfileUpdate }: Props) {
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
  const joinDateFallback = profile.created_at?.slice(0, 10).replace(/-/g, '.') ?? null

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
        showError(err.error ?? '저장에 실패했습니다.')
        return
      }
      onProfileUpdate({ username: nameValue.trim() })
      setEditingName(false)
      showSuccess('닉네임이 변경되었습니다.')
    } catch {
      showError('저장에 실패했습니다.')
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
        showError(err.error ?? '저장에 실패했습니다.')
        return
      }
      onProfileUpdate({ bio: bioValue })
      setEditingBio(false)
      showSuccess('소개가 변경되었습니다.')
    } catch {
      showError('저장에 실패했습니다.')
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
      if (!res.ok) { showError('프로필 사진 변경에 실패했습니다.'); return }
      onProfileUpdate({ avatar_url: url })
      setAvatarPickerOpen(false)
      showSuccess('프로필 사진이 변경되었습니다.')
      window.dispatchEvent(new CustomEvent('avatar-changed', { detail: url }))
    } catch {
      showError('프로필 사진 변경에 실패했습니다.')
    }
  }

  const handleAvatarReset = async () => {
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: DEFAULT_AVATAR_URL }),
      })
      if (!res.ok) { showError('프로필 사진 초기화에 실패했습니다.'); return }
      onProfileUpdate({ avatar_url: DEFAULT_AVATAR_URL })
      setAvatarPickerOpen(false)
      showSuccess('프로필 사진이 초기화되었습니다.')
      window.dispatchEvent(new CustomEvent('avatar-changed', { detail: null }))
    } catch {
      showError('프로필 사진 초기화에 실패했습니다.')
    }
  }

  const withdrawAccount = async () => {
    setWithdrawing(true)
    try {
      const res = await fetch('/api/profile', { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        showError(err.error ?? '탈퇴에 실패했습니다.')
        return
      }
      await signOut({ callbackUrl: '/' })
    } catch {
      showError('탈퇴에 실패했습니다.')
    } finally {
      setWithdrawing(false)
      setShowWithdraw(false)
    }
  }

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="rounded-lg border border-[var(--border)] bg-[#1a1510] p-4 sm:p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="relative h-24 w-24 flex-none">
              <div className="relative h-24 w-24 overflow-hidden rounded-md border border-[rgba(200,144,10,0.45)] bg-[#120e09]">
                <Image src={avatarUrl} alt="" fill sizes="96px" className="object-cover" />
              </div>
              <AvatarEditOverlay onClick={() => setAvatarPickerOpen(true)} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
                {editingName ? (
                  <>
                    <input
                      value={nameValue}
                      onChange={e => setNameValue(e.target.value)}
                      maxLength={20}
                      autoFocus
                      className="min-h-11 min-w-0 rounded bg-[#120e09] px-3 text-[1rem] outline-none"
                      style={{ border: '1px solid var(--gold-dim)', color: '#e8dcc8', fontFamily: 'var(--font-body)' }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveName()
                        if (e.key === 'Escape') { setEditingName(false); setNameValue(profile.username ?? '') }
                      }}
                    />
                    <button
                      type="button"
                      onClick={saveName}
                      disabled={nameSaving}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-[rgba(200,144,10,0.35)] text-[var(--gold)] transition hover:bg-[rgba(200,144,10,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
                      aria-label="닉네임 저장"
                    >
                      <Check size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingName(false); setNameValue(profile.username ?? '') }}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-[var(--border)] text-[#8a7a62] transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
                      aria-label="닉네임 편집 취소"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="min-w-0 break-words font-serif text-[1.625rem] leading-tight" style={{ color: '#e8dcc8' }}>{displayName}</h2>
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-transparent text-[#8a7a62] transition hover:border-[var(--border)] hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
                      aria-label="닉네임 편집"
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>

              <p className="break-all text-[0.875rem]" style={{ color: 'var(--text-tertiary)' }}>{email}</p>

              {profile.created_at && (
                <div className="mt-2 flex items-center gap-1.5 text-[0.875rem]" style={{ color: 'var(--text-tertiary)' }}>
                  <Calendar size={15} aria-hidden="true" />
                  <LocalTime className="font-mono" value={profile.created_at} fallback={joinDateFallback} locale="ko-KR" dateStyle="medium" />
                </div>
              )}

              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-heading text-[1rem]" style={{ color: 'var(--gold)' }}>내 소개</h3>
                  {!editingBio && (
                    <button
                      type="button"
                      onClick={() => setEditingBio(true)}
                      className="inline-flex min-h-11 items-center gap-2 rounded border border-[var(--border)] px-3 text-[0.9375rem] text-[#9a8a70] transition hover:border-[rgba(200,144,10,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
                    >
                      <Pencil size={15} aria-hidden="true" />
                      편집
                    </button>
                  )}
                </div>

                {editingBio ? (
                  <div>
                    <textarea
                      value={bioValue}
                      onChange={e => setBioValue(e.target.value)}
                      maxLength={300}
                      rows={5}
                      autoFocus
                      placeholder="간단한 자기소개를 작성해보세요."
                      className="w-full resize-none rounded bg-[#120e09] px-3 py-3 text-[1rem] leading-relaxed outline-none"
                      style={{ border: '1px solid var(--gold-dim)', color: '#e8dcc8', fontFamily: 'var(--font-body)' }}
                    />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[0.875rem]" style={{ color: 'var(--text-tertiary)' }}>{bioValue.length}/300</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setEditingBio(false); setBioValue(profile.bio ?? '') }}
                          className="min-h-11 rounded border border-[var(--border)] px-4 text-[0.9375rem] text-[#9a8a70] transition hover:bg-white/5"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={saveBio}
                          disabled={bioSaving}
                          className="min-h-11 rounded bg-[var(--gold)] px-4 font-heading text-[0.9375rem] font-semibold text-[var(--bg-deep)] transition hover:brightness-110 disabled:opacity-60"
                        >
                          {bioSaving ? '저장 중' : '저장'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="min-h-20 whitespace-pre-wrap rounded border border-[rgba(200,144,10,0.1)] bg-[#120e09] p-3 text-[1rem] leading-relaxed" style={{ color: profile.bio ? '#b7a783' : '#6f634f' }}>
                    {profile.bio || '아직 소개가 없습니다.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="rounded-lg border border-[var(--border)] bg-[#1a1510] p-4">
          <h3 className="font-heading text-[1rem]" style={{ color: 'var(--gold)' }}>계정 관리</h3>
          <div className="mt-4 grid gap-2">
            {!showWithdraw && (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded border border-[var(--border)] bg-white/[0.03] px-4 text-[0.9375rem] text-[#b7a783] transition hover:border-[rgba(200,144,10,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
              >
                <LogOut size={16} aria-hidden="true" />
                로그아웃
              </button>
            )}

            {showWithdraw ? (
              <div className="grid gap-3 rounded border border-[rgba(139,26,26,0.45)] bg-[rgba(139,26,26,0.08)] p-3">
                <p className="text-[0.9375rem] leading-relaxed text-[#ff8a8a]">
                  탈퇴하면 모든 덱과 프로필이 영구 삭제됩니다. 정말 탈퇴하시겠습니까?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowWithdraw(false)}
                    className="min-h-11 flex-1 rounded border border-[var(--border)] px-3 text-[0.9375rem] text-[#b7a783]"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={withdrawAccount}
                    disabled={withdrawing}
                    className="min-h-11 flex-1 rounded border border-[rgba(139,26,26,0.5)] bg-[rgba(139,26,26,0.9)] px-3 text-[0.9375rem] font-semibold text-[#ff8a8a] disabled:opacity-60"
                  >
                    {withdrawing ? '처리 중' : '탈퇴 확인'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowWithdraw(true)}
                className="min-h-11 rounded border border-transparent px-4 text-[0.9375rem] text-[#8b5a5a] transition hover:border-[rgba(139,26,26,0.35)] hover:bg-[rgba(139,26,26,0.08)]"
              >
                회원 탈퇴
              </button>
            )}
          </div>
        </aside>
      </div>

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

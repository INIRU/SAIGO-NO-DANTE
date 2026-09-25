'use client'

import { getIdentityPortraitUrl } from '@/lib/utils/images'
import { useEffect, useState, useCallback, useRef, forwardRef } from 'react'
import Image from 'next/image'
import { useCollectionModel } from '@/components/collection/useCollectionModel'
import { useSearchParams } from 'next/navigation'
import { useQueryState, parseAsString } from 'nuqs'
import { STORAGE_BASE, GRADE_COLORS, SIN_COLORS, normalizeSin, type SinType } from '@/lib/data/sinners'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { Check, CheckSquare, Square, Link2, Download } from 'lucide-react'
import DownloadModal from './DownloadModal'
import { normalizeThemeKeyword, THEME_KEYWORDS } from '@/lib/constants/keywords'
import { decodeCollectionAsync, BITS_IDENTITY, BITS_EGO, BITS_PER_SINNER } from '@/lib/collection'
import type { SinnerInfo, IdentityInfo, EGOInfo, CollectionData } from '@/lib/collection'

// ── 비트 인코딩 (저장/공유용, 이 컴포넌트에서만 사용) ───────────────────────
const TOTAL_BITS = 12 * BITS_PER_SINNER
const TOTAL_BYTES = TOTAL_BITS / 8

async function encodeCollection(
  owned: Set<string>,
  sinners: SinnerInfo[],
  identities: Record<string, IdentityInfo[]>,
  egos: Record<string, EGOInfo[]>,
): Promise<string> {
  const bits = new Uint8Array(TOTAL_BYTES)

  for (let si = 0; si < 12; si++) {
    const sinner = sinners[si]
    if (!sinner) continue
    const off = si * BITS_PER_SINNER

    const ids = identities[sinner.id] ?? []
    for (let i = 0; i < ids.length && i < BITS_IDENTITY; i++) {
      if (owned.has(ids[i].id)) {
        const bitIdx = off + i
        bits[Math.floor(bitIdx / 8)] |= (1 << (7 - (bitIdx % 8)))
      }
    }

    const egoList = egos[sinner.id] ?? []
    for (let i = 0; i < egoList.length && i < BITS_EGO; i++) {
      if (owned.has(egoList[i].id)) {
        const bitIdx = off + BITS_IDENTITY + i
        bits[Math.floor(bitIdx / 8)] |= (1 << (7 - (bitIdx % 8)))
      }
    }
  }

  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  writer.write(bits)
  writer.close()
  const compressed = await new Response(cs.readable).arrayBuffer()
  return btoa(String.fromCharCode(...new Uint8Array(compressed)))
}

// ── 이미지 URL 헬퍼 ─────────────────────────────────────────────────────────
function identityProfileUrl(identity: IdentityInfo): string {
  if (!identity.game_id || !identity.folder_name) return ''
  return getIdentityPortraitUrl(identity.sinner_id, identity.folder_name, identity.game_id, false)
}

function sinnerLogoUrl(sinnerId: string): string {
  return `${STORAGE_BASE}/icons/Sinners/${sinnerId}.webp`
}

// ── 키워드 필터 ─────────────────────────────────────────────────────────────
const MAIN_KEYWORDS: { keyword: string; sin: SinType }[] = [
  { keyword: '출혈', sin: 'wrath' },
  { keyword: '화상', sin: 'lust' },
  { keyword: '침잠', sin: 'gloom' },
  { keyword: '파열', sin: 'gluttony' },
  { keyword: '호흡', sin: 'pride' },
  { keyword: '충전', sin: 'envy' },
  { keyword: '진동', sin: 'sloth' },
]

// ── 등급 정렬 순서 ──────────────────────────────────────────────────────────
const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

// ── 컴포넌트 ────────────────────────────────────────────────────────────────
const LOCAL_STORAGE_KEY = 'limbus-collection'

interface CollectionSectionProps {
  savedCode?: string | null
  persistMode?: 'db' | 'local'
}

export default function CollectionSection({ savedCode, persistMode = 'db' }: CollectionSectionProps) {
  const searchParams = useSearchParams()

  const [data, setData] = useState<CollectionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [owned, setOwned] = useState<Set<string>>(new Set())
  const [activeSinner, setActiveSinner] = useQueryState('sinner', parseAsString.withDefault(''))
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [autoSaved, setAutoSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [keywordFilter, setKeywordFilter] = useQueryState('kw', parseAsString.withDefault(''))
  const [showUnowned, setShowUnowned] = useQueryState('unowned', parseAsString.withDefault('true'))
  const [generating, setGenerating] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [downloadOptions, setDownloadOptions] = useState<{ include: Set<'identity' | 'ego'>; groupBy: 'sinner' | 'keyword' }>({ include: new Set(['identity', 'ego']), groupBy: 'sinner' })
  const { getIconUrl } = useKeywordData()
  const downloadRef = useRef<HTMLDivElement>(null)

  // 데이터 로드
  useEffect(() => {
    fetch('/api/collection')
      .then(r => {
        if (!r.ok) throw new Error(`Collection API error: ${r.status}`)
        return r.json()
      })
      .then(async (d: CollectionData) => {
        setData(d)
        if (d.sinners.length > 0 && !activeSinner) setActiveSinner(d.sinners[0].id)

        if (persistMode === 'local') {
          // local 모드: localStorage 우선, 없으면 로그인 유저의 DB 저장값 동기화
          const localCode = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null
          if (localCode && d.sinners.length > 0) {
            const decoded = await decodeCollectionAsync(localCode, d.sinners, d.identities, d.egos)
            setOwned(decoded)
          } else {
            // localStorage 비어있으면 DB에서 가져와 동기화
            try {
              const res = await fetch('/api/profile')
              if (res.ok) {
                const profile = await res.json()
                const dbCode = profile?.profile?.collection_code
                if (dbCode && d.sinners.length > 0) {
                  const decoded = await decodeCollectionAsync(dbCode, d.sinners, d.identities, d.egos)
                  setOwned(decoded)
                  localStorage.setItem(LOCAL_STORAGE_KEY, dbCode)
                }
              }
            } catch {
              // 비로그인이면 무시
            }
          }
        } else {
          // db 모드: URL 파라미터 또는 DB 저장값
          const code = searchParams?.get('collection') || savedCode
          if (code && d.sinners.length > 0) {
            const decoded = await decodeCollectionAsync(code, d.sinners, d.identities, d.egos)
            setOwned(decoded)
          }
        }
      })
      .finally(() => setLoading(false))
  }, [searchParams, persistMode, savedCode])

  // 토글
  const toggle = useCallback((id: string) => {
    setOwned(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setDirty(true)
  }, [])

  // 전체 선택/해제 (현재 수감자)
  const selectAll = useCallback(() => {
    if (!data) return
    setOwned(prev => {
      const next = new Set(prev)
      for (const id of data.identities[activeSinner] ?? []) next.add(id.id)
      for (const ego of data.egos[activeSinner] ?? []) next.add(ego.id)
      return next
    })
    setDirty(true)
  }, [data, activeSinner])

  const deselectAll = useCallback(() => {
    if (!data) return
    setOwned(prev => {
      const next = new Set(prev)
      for (const id of data.identities[activeSinner] ?? []) next.delete(id.id)
      for (const ego of data.egos[activeSinner] ?? []) next.delete(ego.id)
      return next
    })
    setDirty(true)
  }, [data, activeSinner])

  // 저장 (local: localStorage, db: API)
  const saveCollection = useCallback(async () => {
    if (!data) return
    setSaving(true)
    setSaveError(null)
    try {
      const code = await encodeCollection(owned, data.sinners, data.identities, data.egos)
      if (persistMode === 'local') {
        localStorage.setItem(LOCAL_STORAGE_KEY, code)
        setDirty(false)
      } else {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ collection_code: code }),
        })
        if (res.ok) {
          setDirty(false)
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        } else {
          const err = await res.json().catch(() => ({}))
          setSaveError(err.error ?? `저장 실패 (${res.status})`)
          setTimeout(() => setSaveError(null), 4000)
        }
      }
    } catch (e) {
      setSaveError('네트워크 오류로 저장에 실패했습니다.')
      setTimeout(() => setSaveError(null), 4000)
    } finally {
      setSaving(false)
    }
  }, [data, owned, persistMode])

  // local 모드: dirty 변경 시 debounce 자동 저장 + 로그인 시 DB 동기화
  useEffect(() => {
    if (persistMode !== 'local' || !dirty || !data) return
    const timer = setTimeout(async () => {
      const code = await encodeCollection(owned, data.sinners, data.identities, data.egos)
      localStorage.setItem(LOCAL_STORAGE_KEY, code)
      // 로그인 상태면 DB에도 동기화 (await로 결과 확인)
      try {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ collection_code: code }),
        })
        if (res.ok) {
          setAutoSaved(true)
          setTimeout(() => setAutoSaved(false), 2000)
        } else {
          // DB 저장 실패 시에도 로컬은 저장됨
          setAutoSaved(true)
          setTimeout(() => setAutoSaved(false), 2000)
        }
      } catch {
        // 비로그인 또는 네트워크 오류 — 로컬 저장만
        setAutoSaved(true)
        setTimeout(() => setAutoSaved(false), 2000)
      }
      setDirty(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [persistMode, dirty, data, owned])

  // 공유 링크 복사
  const copyShareLink = useCallback(async () => {
    if (!data) return
    const code = await encodeCollection(owned, data.sinners, data.identities, data.egos)
    const url = `${window.location.origin}/collection?code=${encodeURIComponent(code)}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [data, owned])

  // 전체 스크롤 다운로드
  const generateImage = useCallback(async () => {
    if (!data || generating) return
    setGenerating(true)
    try {
      // React 렌더 대기
      await new Promise(r => setTimeout(r, 500))
      const container = downloadRef.current
      if (!container) return

      // 이미지 로드 대기
      const images = container.querySelectorAll('img')
      await Promise.allSettled(
        Array.from(images).map(img =>
          img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r })
        )
      )

      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(container, {
        useCORS: true,
        scale: 1,
        backgroundColor: '#0d0b08',
      })

      const link = document.createElement('a')
      link.download = `limbus-collection-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('이미지 생성 실패:', err)
    } finally {
      setGenerating(false)
    }
  }, [data, generating])

  // 통계
  const { stats, sinnerCounts, filtered } = useCollectionModel(data, owned, keywordFilter)

  if (loading) {
    return (
      <section style={{ background: '#1a1510', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1.5rem' }}>
        <div style={{ width: '8.75rem', height: '0.875rem', background: '#2a2015', borderRadius: '0.125rem', marginBottom: '1rem' }} />
        <div className="flex gap-2 mb-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: '#2a2015' }} />
          ))}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ aspectRatio: '3/4', background: '#2a2015', borderRadius: '0.375rem', opacity: 0.4 + i * 0.05 }} />
          ))}
        </div>
      </section>
    )
  }

  if (!data) return null

  const allIdentities = (filtered.identities[activeSinner] ?? [])
  const allEgos = (filtered.egos[activeSinner] ?? [])
  const currentIdentities = showUnowned === 'true' ? allIdentities : allIdentities.filter(i => owned.has(i.id))
  const currentEgos = showUnowned === 'true' ? allEgos : allEgos.filter(e => owned.has(e.id))

  // EGO를 등급별로 그룹핑
  const egosByGrade = GRADE_ORDER.reduce<Record<string, EGOInfo[]>>((acc, grade) => {
    const filtered = currentEgos.filter(e => e.grade === grade)
    if (filtered.length > 0) acc[grade] = filtered
    return acc
  }, {})

  return (
    <section>
      <div className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 style={{ color: '#f0e6d2', fontFamily: 'var(--font-heading)', fontSize: '1.25rem' }}>보유 현황</h2>
        <p className="flex items-baseline gap-4" style={{ color: '#9c8b73', fontSize: '0.875rem' }}>
          <span>인격 <b style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-title)', fontSize: '1.125rem', fontWeight: 400 }}>{stats.ownedIdentities}</b>/{stats.totalIdentities}</span>
          <span>E.G.O <b style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-title)', fontSize: '1.125rem', fontWeight: 400 }}>{stats.ownedEgos}</b>/{stats.totalEgos}</span>
        </p>
      </div>

      <div
        style={{
          background: '#1a1510',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {/* 수감자 탭 */}
        <div
          className="flex gap-1 p-3 overflow-x-auto"
          style={{ borderBottom: '1px solid var(--border)', background: '#150f0a' }}
        >
          {data.sinners.map(s => {
            const isActive = s.id === activeSinner
            const ownCount = (sinnerCounts[s.id]?.owned ?? 0)
            const totalCount = (sinnerCounts[s.id]?.total ?? 0)
            return (
              <button
                key={s.id}
                onClick={() => setActiveSinner(s.id)}
                className="flex flex-col items-center gap-1 px-2 py-1.5 rounded transition-all flex-shrink-0"
                style={{
                  background: isActive ? 'rgba(200,144,10,0.12)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--gold-dim)' : 'transparent'}`,
                  cursor: 'pointer',
                  minWidth: '3.25rem',
                }}
              >
                <Image
                  src={sinnerLogoUrl(s.id)}
                  alt={s.name_kr}
                  width={28}
                  height={28}
                  style={{
                    borderRadius: '50%',
                    opacity: isActive ? 1 : 0.4,
                    transition: 'opacity 0.2s',
                    filter: isActive ? 'none' : 'grayscale(0.5)',
                  }}
                />
                <span style={{
                  fontSize: '0.6875rem',
                  color: isActive ? 'var(--gold)' : '#6a6080',
                  fontFamily: 'var(--font-heading)',
                  whiteSpace: 'nowrap',
                }}>
                  {s.name_kr}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: ownCount === totalCount ? 'var(--gold)' : '#5a5070',
                }}>
                  {ownCount}/{totalCount}
                </span>
              </button>
            )
          })}
        </div>

        <div className="p-4">
          {/* 키워드 필터 */}
          <div className="flex items-center gap-1.5 flex-wrap mb-4 pb-3" style={{ borderBottom: '1px solid rgba(58,42,21,0.3)' }}>
            <button
              onClick={() => setKeywordFilter(null)}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all duration-200"
              style={{
                background: !keywordFilter || keywordFilter === '' ? 'rgba(200,144,10,0.15)' : 'transparent',
                border: `1px solid ${!keywordFilter || keywordFilter === '' ? 'var(--gold-dim)' : 'rgba(58,42,21,0.4)'}`,
                color: !keywordFilter || keywordFilter === '' ? 'var(--gold)' : '#6a6080',
                cursor: 'pointer',
              }}
            >
              전체
            </button>
            {MAIN_KEYWORDS.map(({ keyword, sin }) => {
              const isActive = keywordFilter === keyword
              const color = SIN_COLORS[sin]
              return (
                <button
                  key={keyword}
                  onClick={() => setKeywordFilter(isActive ? null : keyword)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all duration-200"
                  style={{
                    background: isActive ? `${color}20` : 'transparent',
                    border: `1px solid ${isActive ? color : 'rgba(58,42,21,0.4)'}`,
                    color: isActive ? color : '#6a6080',
                    cursor: 'pointer',
                  }}
                >
                  {getIconUrl(keyword) && (
                    <Image
                      src={getIconUrl(keyword)!}
                      alt={keyword}
                      width={14}
                      height={14}
                      unoptimized
                      style={{
                        filter: isActive ? `drop-shadow(0 0 3px ${color}80)` : 'grayscale(0.7) brightness(0.5)',
                      }}
                    />
                  )}
                  {keyword}
                </button>
              )
            })}
          </div>

          {/* 미보유 표시 + 전체 선택/해제 */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={selectAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-opacity hover:opacity-80"
              style={{ color: '#a08a60', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-heading)' }}
            >
              <CheckSquare size={11} />
              전체 선택
            </button>
            <button
              onClick={deselectAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-opacity hover:opacity-80"
              style={{ color: '#a08a60', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-heading)' }}
            >
              <Square size={11} />
              전체 해제
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setShowUnowned(showUnowned === 'true' ? 'false' : 'true')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-200"
              style={{
                background: showUnowned === 'true' ? 'rgba(90,80,112,0.15)' : 'transparent',
                border: `1px solid ${showUnowned === 'true' ? '#5a5070' : 'rgba(58,42,21,0.4)'}`,
                color: showUnowned === 'true' ? '#8a7aaa' : '#6a6080',
                cursor: 'pointer',
              }}
            >
              {showUnowned === 'true' ? (
                <CheckSquare size={12} />
              ) : (
                <Square size={12} />
              )}
              미보유 표시
            </button>
          </div>

          {/* 공유 / 다운로드 */}
          <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid rgba(58,42,21,0.3)' }}>
            {/* DB 모드: 수동 저장 버튼 + 성공/에러 표시 */}
            {persistMode === 'db' && dirty && (
              <button
                onClick={saveCollection}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 hover:brightness-110"
                style={{
                  background: 'rgba(200,144,10,0.15)',
                  color: 'var(--gold)',
                  border: '1px solid var(--gold-dim)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                <Check size={12} />
                {saving ? '저장 중...' : '저장'}
              </button>
            )}
            {persistMode === 'db' && saved && (
              <span className="flex items-center gap-1 text-xs" style={{ color: '#50b878', fontFamily: 'var(--font-heading)' }}>
                <Check size={12} />
                저장 완료
              </span>
            )}
            {saveError && (
              <span className="text-xs" style={{ color: '#d06060', fontFamily: 'var(--font-heading)' }}>
                {saveError}
              </span>
            )}
            {/* Local 모드: 자동 저장 표시 */}
            {persistMode === 'local' && autoSaved && (
              <span className="flex items-center gap-1 text-xs" style={{ color: '#50b878', fontFamily: 'var(--font-heading)' }}>
                <Check size={12} />
                자동 저장됨
              </span>
            )}
            <button
              onClick={copyShareLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 hover:brightness-110"
              style={{
                background: copied ? 'rgba(26,100,26,0.8)' : 'rgba(200,144,10,0.15)',
                color: copied ? '#80ff80' : 'var(--gold)',
                border: `1px solid ${copied ? 'rgba(26,100,26,0.5)' : 'var(--gold-dim)'}`,
                cursor: 'pointer',
                fontFamily: 'var(--font-heading)',
              }}
            >
              {copied ? <Check size={12} /> : <Link2 size={12} />}
              {copied ? '복사 완료!' : '공유 링크 복사'}
            </button>
            <button
              onClick={() => setShowDownloadModal(true)}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 hover:brightness-110"
              style={{
                background: 'rgba(90,80,112,0.15)',
                color: '#8a7aaa',
                border: '1px solid rgba(90,80,112,0.4)',
                cursor: generating ? 'wait' : 'pointer',
                fontFamily: 'var(--font-heading)',
                opacity: generating ? 0.6 : 1,
              }}
            >
              <Download size={12} />
              {generating ? '생성 중...' : '이미지 다운로드'}
            </button>
          </div>

          {/* 인격 섹션 */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8125rem', fontFamily: 'var(--font-heading)' }}>인격</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                {currentIdentities.filter(i => owned.has(i.id)).length}/{currentIdentities.length}
              </span>
            </div>

            {currentIdentities.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {currentIdentities.map(identity => {
                const isOwned = owned.has(identity.id)
                const url = identityProfileUrl(identity)
                return (
                  <button
                    key={identity.id}
                    onClick={() => toggle(identity.id)}
                    className="relative rounded overflow-hidden transition-all duration-200"
                    style={{
                      aspectRatio: '3/4',
                      border: `2px solid ${isOwned ? 'var(--gold-dim)' : 'rgba(58,42,21,0.3)'}`,
                      cursor: 'pointer',
                      background: '#0a0806',
                    }}
                  >
                    {url && (
                      <Image
                        src={url}
                        alt={identity.name_kr}
                        fill
                        sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
                        className="object-cover"
                        style={{
                          objectPosition: 'center top',
                          filter: isOwned ? 'none' : 'grayscale(1) brightness(0.3)',
                          transition: 'filter 0.2s',
                        }}
                      />
                    )}
                    {/* 체크 표시 */}
                    {isOwned && (
                      <div style={{
                        position: 'absolute', top: '0.1875rem', right: '0.1875rem',
                        width: '1rem', height: '1rem', borderRadius: '50%',
                        background: 'var(--gold)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Check size={10} style={{ color: '#0d0b08' }} />
                      </div>
                    )}
                    {/* 이름 */}
                    <div
                      style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(to top, rgba(10,8,6,0.95) 0%, transparent 100%)',
                        padding: '1rem 0.25rem 0.25rem',
                      }}
                    >
                      <p style={{
                        fontSize: '0.8125rem',
                        color: isOwned ? '#c8a450' : '#6a6080',
                        textAlign: 'center',
                        fontFamily: 'var(--font-heading)',
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {identity.name_kr}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
            ) : (
              <p className="text-center py-6" style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                해당 키워드의 인격이 없습니다
              </p>
            )}
          </div>

          {/* EGO 섹션 */}
          {Object.keys(egosByGrade).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8125rem', fontFamily: 'var(--font-heading)' }}>E.G.O</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                  {currentEgos.filter(e => owned.has(e.id)).length}/{currentEgos.length}
                </span>
              </div>

              {Object.entries(egosByGrade).map(([grade, egoList]) => (
                <div key={grade} className="mb-3">
                  <p className="mb-1.5" style={{
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.1em',
                    color: GRADE_COLORS[grade] ?? '#555',
                  }}>
                    {grade}
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    {egoList.map(ego => {
                      const isOwned = owned.has(ego.id)
                      const sinType = normalizeSin(ego.sin_affinity)
                      const egoSinColor = sinType ? SIN_COLORS[sinType] : 'var(--gold-dim)'
                      return (
                        <button
                          key={ego.id}
                          onClick={() => toggle(ego.id)}
                          className="relative rounded overflow-hidden transition-all duration-200"
                          style={{
                            aspectRatio: '1',
                            border: `2px solid ${isOwned ? egoSinColor : 'rgba(58,42,21,0.3)'}`,
                            cursor: 'pointer',
                            background: '#0a0806',
                          }}
                        >
                          {ego.image_url && (
                            <Image
                              src={ego.image_url}
                              alt={ego.name_kr ?? ''}
                              fill
                              sizes="(max-width: 640px) 25vw, (max-width: 768px) 20vw, (max-width: 1024px) 16vw, 12vw"
                              className="object-cover"
                              style={{
                                filter: isOwned ? 'none' : 'grayscale(1) brightness(0.3)',
                                transition: 'filter 0.2s',
                              }}
                            />
                          )}
                          {isOwned && (
                            <div style={{
                              position: 'absolute', top: '0.125rem', right: '0.125rem',
                              width: '0.875rem', height: '0.875rem', borderRadius: '50%',
                              background: egoSinColor,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Check size={8} style={{ color: '#0d0b08' }} />
                            </div>
                          )}
                          <div
                            style={{
                              position: 'absolute', bottom: 0, left: 0, right: 0,
                              background: 'linear-gradient(to top, rgba(10,8,6,0.95) 0%, transparent 100%)',
                              padding: '0.75rem 0.1875rem 0.1875rem',
                            }}
                          >
                            <p style={{
                              fontSize: '0.75rem',
                              color: isOwned ? '#c8a450' : '#6a6080',
                              textAlign: 'center',
                              fontFamily: 'var(--font-heading)',
                              lineHeight: 1.2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {ego.name_kr}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
      {/* 다운로드 옵션 모달 */}
      <DownloadModal
        open={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        generating={generating}
        onConfirm={(opts) => {
          setDownloadOptions(opts)
          setShowDownloadModal(false)
          // state 업데이트 후 렌더링 대기
          setTimeout(() => generateImage(), 50)
        }}
      />

      {/* 전체 스크롤 다운로드용 히든 컨테이너 */}
      {generating && data && <DownloadContainer
        ref={downloadRef}
        data={data}
        owned={owned}
        stats={stats}
        downloadOptions={downloadOptions}
        sinnerLogoUrl={sinnerLogoUrl}
        identityProfileUrl={identityProfileUrl}
      />}
    </section>
  )
}

// ── 다운로드 이미지용 히든 컨테이너 ──────────────────────────────────
const DownloadContainer = forwardRef<HTMLDivElement, {
  data: CollectionData
  owned: Set<string>
  stats: { ownedIdentities: number; totalIdentities: number; ownedEgos: number; totalEgos: number }
  downloadOptions: { include: Set<'identity' | 'ego'>; groupBy: 'sinner' | 'keyword' }
  sinnerLogoUrl: (sid: string) => string
  identityProfileUrl: (i: IdentityInfo) => string
}>(function DownloadContainer({ data, owned, stats, downloadOptions, sinnerLogoUrl, identityProfileUrl }, ref) {
  const showIdentity = downloadOptions.include.has('identity')
  const showEgo = downloadOptions.include.has('ego')
  const groupBy = downloadOptions.groupBy

  // 키워드별 그룹핑
  const keywordGroups: Record<string, { identities: IdentityInfo[]; egos: EGOInfo[] }> = {}
  if (groupBy === 'keyword') {
    const sinKwMap: Record<string, string> = { wrath: '출혈', lust: '화상', gloom: '침잠', gluttony: '파열', pride: '호흡', envy: '충전', sloth: '진동' }
    for (const sinner of data.sinners) {
      const ids = (data.identities[sinner.id] ?? []).filter(i => owned.has(i.id))
      const egoList = (data.egos[sinner.id] ?? []).filter(e => owned.has(e.id))
      for (const id of ids) {
        const kws = new Set((id.keywords ?? []).map(normalizeThemeKeyword))
        let matched = false
        for (const t of THEME_KEYWORDS) {
          if (kws.has(t)) {
            if (!keywordGroups[t]) keywordGroups[t] = { identities: [], egos: [] }
            keywordGroups[t].identities.push(id)
            matched = true
          }
        }
        if (!matched) {
          if (!keywordGroups['기타']) keywordGroups['기타'] = { identities: [], egos: [] }
          keywordGroups['기타'].identities.push(id)
        }
      }
      for (const ego of egoList) {
        const sinType = normalizeSin(ego.sin_affinity)
        const group = (sinType && sinKwMap[sinType]) || '기타'
        if (!keywordGroups[group]) keywordGroups[group] = { identities: [], egos: [] }
        keywordGroups[group].egos.push(ego)
      }
    }
  }

  const renderIdentityGrid = (ids: IdentityInfo[]) => (
    <div style={{ marginBottom: '12px' }}>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginBottom: '10px' }}>인격</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '8px' }}>
        {ids.map(identity => {
          const url = identityProfileUrl(identity)
          return (
            <div key={identity.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', borderRadius: '4px', overflow: 'hidden', border: '2px solid #8a6010', background: '#0a0806' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- crossOrigin required for canvas image download */}
                {url && <img src={url} alt={identity.name_kr} crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#c8a450', textAlign: 'center', lineHeight: 1.3, marginTop: '4px', wordBreak: 'keep-all' }}>{identity.name_kr}</p>
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderEgoGrid = (egoList: EGOInfo[]) => (
    <div>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginBottom: '10px', marginTop: '4px' }}>E.G.O</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '6px' }}>
        {egoList.map(ego => {
          const sinType = normalizeSin(ego.sin_affinity)
          const egoColor = sinType ? SIN_COLORS[sinType] : '#8a6010'
          return (
            <div key={ego.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '4px', overflow: 'hidden', border: `2px solid ${egoColor}`, background: '#0a0806' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- crossOrigin required for canvas image download */}
                {ego.image_url && <img src={ego.image_url} alt={ego.name_kr ?? ''} crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#c8a450', textAlign: 'center', lineHeight: 1.3, marginTop: '3px', wordBreak: 'keep-all' }}>{ego.name_kr}</p>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div ref={ref} style={{ position: 'fixed', left: '-9999px', top: 0, width: '1200px', background: '#0d0b08', padding: '40px', zIndex: -1 }}>
      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid #2a2015' }}>
        <p style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-perfect-dos), monospace', fontSize: '0.6875rem', letterSpacing: '0.2em', marginBottom: '8px' }}>SAIGO NO DANTE</p>
        <p style={{ color: '#c8900a', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px' }}>
          보유 현황{showIdentity && !showEgo ? ' — 인격' : !showIdentity && showEgo ? ' — E.G.O' : ''}
        </p>
        <p style={{ color: '#555', fontFamily: 'var(--font-perfect-dos), monospace', fontSize: '0.8125rem' }}>
          {showIdentity && <>인격 {stats.ownedIdentities}/{stats.totalIdentities}</>}
          {showIdentity && showEgo && <span style={{ fontFamily: 'sans-serif' }}>{' · '}</span>}
          {showEgo && <>EGO {stats.ownedEgos}/{stats.totalEgos}</>}
        </p>
      </div>

      {groupBy === 'sinner' ? (
        data.sinners.map(sinner => {
          const allIds = data.identities[sinner.id] ?? []
          const allEgos = data.egos[sinner.id] ?? []
          const ids = showIdentity ? allIds.filter(i => owned.has(i.id)) : []
          const egoList = showEgo ? allEgos.filter(e => owned.has(e.id)) : []
          if (ids.length === 0 && egoList.length === 0) return null
          return (
            <div key={sinner.id} style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #1a1510' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- crossOrigin required for canvas image download */}
                <img src={sinnerLogoUrl(sinner.id)} alt="" crossOrigin="anonymous" style={{ width: '1.75rem', height: '1.75rem' }} />
                <span style={{ color: '#c8900a', fontSize: '1rem', fontWeight: 'bold' }}>{sinner.name_kr}</span>
                <span style={{ color: '#555', fontFamily: 'var(--font-perfect-dos), monospace', fontSize: '0.6875rem' }}>{ids.length + egoList.length}/{allIds.length + allEgos.length}</span>
              </div>
              {ids.length > 0 && renderIdentityGrid(ids)}
              {egoList.length > 0 && renderEgoGrid(egoList)}
            </div>
          )
        })
      ) : (
        [...THEME_KEYWORDS, '기타' as const].map(themeKw => {
          const group = keywordGroups[themeKw]
          if (!group) return null
          const ids = showIdentity ? group.identities : []
          const egoList = showEgo ? group.egos : []
          if (ids.length === 0 && egoList.length === 0) return null
          return (
            <div key={themeKw} style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #1a1510' }}>
                <span style={{ color: '#c8900a', fontSize: '1rem', fontWeight: 'bold' }}>{themeKw}</span>
                <span style={{ color: '#555', fontFamily: 'var(--font-perfect-dos), monospace', fontSize: '0.6875rem' }}>{ids.length + egoList.length}</span>
              </div>
              {ids.length > 0 && renderIdentityGrid(ids)}
              {egoList.length > 0 && renderEgoGrid(egoList)}
            </div>
          )
        })
      )}

      {/* 푸터 */}
      <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #2a2015' }}>
        <p style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-perfect-dos), monospace', fontSize: '0.75rem', letterSpacing: '0.15em' }}>saigo-no-dante.com</p>
      </div>
    </div>
  )
})

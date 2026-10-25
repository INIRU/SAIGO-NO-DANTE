'use client'

import { getIdentityPortraitUrl } from '@/lib/utils/images'
import { useEffect, useState, useCallback, useRef, forwardRef } from 'react'
import Image from 'next/image'
import { useCollectionModel } from '@/components/collection/useCollectionModel'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useQueryState, parseAsString } from 'nuqs'
import { STORAGE_BASE, GRADE_COLORS, SIN_COLORS, normalizeSin, type SinType } from '@/lib/data/sinners'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { Check, CheckSquare, Square, Link2, Download } from 'lucide-react'
import DownloadModal from './DownloadModal'
import CollectionBoard, { COLLECTION_ALL } from '@/components/collection/CollectionBoard'
import Skeleton from '@/components/ui/Skeleton'
import { normalizeThemeKeyword, THEME_KEYWORDS } from '@/lib/constants/keywords'
import { getLocalizedKeywordName, getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
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

// ── 컴포넌트 ────────────────────────────────────────────────────────────────
const LOCAL_STORAGE_KEY = 'limbus-collection'

interface CollectionSectionProps {
  savedCode?: string | null
  persistMode?: 'db' | 'local'
  /** h1 when the section is the page (/collection). */
  titleAs?: 'h1' | 'h2'
  /** The catalog when the page already rendered it on the server (skips /api/collection). */
  initialData?: CollectionData
}

export default function CollectionSection({ savedCode, persistMode = 'db', titleAs: Title = 'h2', initialData }: CollectionSectionProps) {
  const t = useTranslations('collectionPage')
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
  const downloadRef = useRef<HTMLDivElement>(null)

  // 데이터 로드: a page that rendered the catalog on the server passes it in instead of fetching it again.
  useEffect(() => {
    const catalog: Promise<CollectionData> = initialData ? Promise.resolve(initialData) : fetch('/api/collection')
      .then(r => {
        if (!r.ok) throw new Error(`Collection API error: ${r.status}`)
        return r.json()
      })
    catalog
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
  }, [searchParams, persistMode, savedCode, initialData])

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

  // Marks every currently shown identity and E.G.O as owned or not.
  const setMany = useCallback((ids: string[], on: boolean) => {
    setOwned(prev => {
      const next = new Set(prev)
      for (const id of ids) if (on) next.add(id); else next.delete(id)
      return next
    })
    setDirty(true)
  }, [])

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
          setSaveError(t('saveFailed', { status: res.status }))
          setTimeout(() => setSaveError(null), 4000)
        }
      }
    } catch {
      setSaveError(t('networkError'))
      setTimeout(() => setSaveError(null), 4000)
    } finally {
      setSaving(false)
    }
  }, [data, owned, persistMode, t])

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

  if (loading) return <CollectionSkeleton />

  if (!data) return null

  const visibleIds = (activeSinner === COLLECTION_ALL ? data.sinners : data.sinners.filter(s => s.id === activeSinner))
    .flatMap(s => [...(filtered.identities[s.id] ?? []), ...(filtered.egos[s.id] ?? [])].map(item => item.id))
  const actionButton = 'inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3.5 text-[0.875rem] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)] disabled:cursor-wait disabled:opacity-60'
  return (
    <section>
      <div className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Title className={Title === 'h1' ? 'text-[1.375rem] md:text-[1.75rem]' : 'text-[1.25rem]'} style={{ color: Title === 'h1' ? 'var(--gold)' : '#f0e6d2', fontFamily: 'var(--font-heading)' }}>{t('title')}</Title>
        <dl className="flex gap-6">
          {([[t('identities'), stats.ownedIdentities, stats.totalIdentities], ['E.G.O', stats.ownedEgos, stats.totalEgos]] as const).map(([label, have, all]) => (
            <div key={label} className="grid min-w-[8rem] grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1">
              <dt className="text-[0.8125rem] text-[#9c8b73]">{label}</dt>
              <dd style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-title)', fontSize: '1.125rem', letterSpacing: '0.02em' }}>{have}<span style={{ color: '#8a7d69' }}>/{all}</span></dd>
              <span className="col-span-2 h-[3px] overflow-hidden rounded-full bg-[#2e2417]"><span className="block h-full rounded-full bg-[var(--gold)]" style={{ width: `${all ? (have / all) * 100 : 0}%` }} /></span>
            </div>
          ))}
        </dl>
      </div>
      <CollectionBoard
        data={data}
        filtered={filtered}
        counts={sinnerCounts}
        owned={owned}
        sinner={activeSinner}
        onSinner={setActiveSinner}
        keyword={keywordFilter || null}
        onKeyword={setKeywordFilter}
        showUnowned={showUnowned === 'true'}
        onShowUnowned={show => setShowUnowned(show ? 'true' : 'false')}
        onToggle={toggle}
        actions={<>
          <button type="button" onClick={() => setMany(visibleIds, true)} className={actionButton}><CheckSquare size={16} aria-hidden="true" />{t('selectVisible')}</button>
          <button type="button" onClick={() => setMany(visibleIds, false)} className={actionButton}><Square size={16} aria-hidden="true" />{t('clearAll')}</button>
          <span className="flex-1" />
          {persistMode === 'db' && saved && <span className="flex items-center gap-1 text-[0.8125rem] text-[#6fcf97]"><Check size={14} aria-hidden="true" />{t('saved')}</span>}
          {persistMode === 'local' && autoSaved && <span className="flex items-center gap-1 text-[0.8125rem] text-[#6fcf97]"><Check size={14} aria-hidden="true" />{t('autoSaved')}</span>}
          {saveError && <span className="text-[0.8125rem] text-[#e8a08a]" role="alert">{saveError}</span>}
          <button type="button" onClick={copyShareLink} className={actionButton}>{copied ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}{copied ? t('copied') : t('copyLink')}</button>
          <button type="button" onClick={() => setShowDownloadModal(true)} disabled={generating} className={actionButton}><Download size={16} aria-hidden="true" />{generating ? t('generatingImage') : t('saveImage')}</button>
          {persistMode === 'db' && (
            <button type="button" onClick={saveCollection} disabled={saving || !dirty}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--gold)] px-4 text-[0.875rem] font-bold text-[var(--bg-deep)] transition-[filter,opacity] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)] disabled:cursor-default disabled:opacity-40 disabled:hover:brightness-100">
              {saving ? t('saving') : t('save')}
            </button>
          )}
        </>}
      />
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

/** Same layout as the loaded board: title with totals, sinner strip, filter row, card grid. */
function CollectionSkeleton() {
  return (
    <section aria-busy="true" role="status">
      <div className="mb-4 flex min-h-11 items-center justify-between gap-6"><Skeleton className="h-6 w-24" /><div className="flex gap-6"><Skeleton className="h-8 w-32" /><Skeleton className="h-8 w-32" /></div></div>
      <div className="grid gap-4">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-1.5">{Array.from({ length: 13 }, (_, i) => <Skeleton key={i} line className="h-[6.25rem] rounded-[0.625rem]" />)}</div>
        <div className="flex flex-wrap gap-1.5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-9 w-[4.5rem] !rounded-full" />)}</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} line style={{ aspectRatio: '290 / 428' }} />)}</div>
      </div>
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
  const t = useTranslations('collectionPage')
  const lang = useLocale() as SupportedLang
  const { keywords } = useKeywordData()
  const groupLabel = (kw: string) => kw === '기타' ? t('other') : getLocalizedKeywordName(kw, keywords[kw], lang)
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
      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginBottom: '10px' }}>{t('identities')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '8px' }}>
        {ids.map(identity => {
          const url = identityProfileUrl(identity)
          const name = getLocalizedName(identity, lang)
          return (
            <div key={identity.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', borderRadius: '4px', overflow: 'hidden', border: '2px solid #8a6010', background: '#0a0806' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- crossOrigin required for canvas image download */}
                {url && <img src={url} alt={name} crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#c8a450', textAlign: 'center', lineHeight: 1.3, marginTop: '4px', wordBreak: 'keep-all' }}>{name}</p>
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
          const name = getLocalizedName({ ...ego, name_kr: ego.name_kr ?? '' }, lang)
          return (
            <div key={ego.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '4px', overflow: 'hidden', border: `2px solid ${egoColor}`, background: '#0a0806' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- crossOrigin required for canvas image download */}
                {ego.image_url && <img src={ego.image_url} alt={name} crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#c8a450', textAlign: 'center', lineHeight: 1.3, marginTop: '3px', wordBreak: 'keep-all' }}>{name}</p>
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
          {t('title')}{showIdentity && !showEgo ? ` — ${t('identities')}` : !showIdentity && showEgo ? ' — E.G.O' : ''}
        </p>
        <p style={{ color: '#555', fontFamily: 'var(--font-perfect-dos), monospace', fontSize: '0.8125rem' }}>
          {showIdentity && <>{t('identities')} {stats.ownedIdentities}/{stats.totalIdentities}</>}
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
                <span style={{ color: '#c8900a', fontSize: '1rem', fontWeight: 'bold' }}>{getLocalizedName(sinner, lang)}</span>
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
                <span style={{ color: '#c8900a', fontSize: '1rem', fontWeight: 'bold' }}>{groupLabel(themeKw)}</span>
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

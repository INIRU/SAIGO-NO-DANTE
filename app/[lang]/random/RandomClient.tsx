'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { Copy, Shuffle } from 'lucide-react'
import type { Sinner, Identity, EGO } from '@/lib/types'
import type { SinnerInfo, IdentityInfo, EGOInfo } from '@/lib/collection'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n'
import { decodeCollectionAsync } from '@/lib/collection'
import { generateRandom, validateConditions } from '@/lib/random/engine'
import type { KeywordCondition, RandomResult } from '@/lib/random/engine'
import { encodeRandomResult } from '@/lib/random/deckCode'
import { useHtmlFlag } from '@/hooks/useHtmlFlag'
import OptionPanel from '@/components/random/OptionPanel'
import ResultGrid from '@/components/random/ResultGrid'
import { showSuccess, showError, showWarning } from '@/lib/toast'
import styles from '@/components/random/random.module.css'

type Props = { sinners: Sinner[]; identities: Identity[]; egos: EGO[] }

const COLLECTION_CODE_KEY = 'random_collection_code'
/** Stagger (per card) + flip duration of a full roll, in ms; the roll button stays busy until the last card lands. */
const ROLL_MS = 12 * 45 + 420

const sinnerNames = (list: Sinner[], lang: SupportedLang) => list.map(s => getLocalizedName(s, lang)).join(', ')

export default function RandomClient({ sinners, identities, egos }: Props) {
  useHtmlFlag('with-tool-screen')
  const { data: session } = useSession()
  const t = useTranslations('randomPage')
  const lang = useLocale() as SupportedLang
  const [identityEnabled, setIdentityEnabled] = useState(true)
  const [egoEnabled, setEgoEnabled] = useState(true)
  const [collectionEnabled, setCollectionEnabled] = useState(false)
  const [collectionCode, setCollectionCode] = useState('')
  const [keywords, setKeywords] = useState<KeywordCondition[]>([])
  const [rarityFilter, setRarityFilter] = useState<Set<number> | null>(null) // null = all
  const [tab, setTab] = useState<'identity' | 'ego'>('identity')

  const [result, setResult] = useState<RandomResult | null>(null)
  const [rollId, setRollId] = useState(0)
  const [rerolledSinnerId, setRerolledSinnerId] = useState<string | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [deckCode, setDeckCode] = useState<string | null>(null)
  const [ownedIds, setOwnedIds] = useState<Set<string> | null>(null)
  const rollTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Collection code: ?code= (auto-enables) > saved code > profile code.
  useEffect(() => {
    const urlCode = new URLSearchParams(window.location.search).get('code')
    if (urlCode) { setCollectionCode(urlCode); setCollectionEnabled(true); return }
    const saved = localStorage.getItem(COLLECTION_CODE_KEY)
    if (saved) setCollectionCode(saved)
  }, [])

  useEffect(() => {
    if (collectionCode || !session?.user?.email) return
    fetch('/api/profile')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.profile?.collection_code) setCollectionCode(current => current || data.profile.collection_code) })
      .catch(() => {})
  }, [session?.user?.email, collectionCode])

  // Decode collection code (debounced)
  useEffect(() => {
    if (!collectionEnabled || !collectionCode.trim()) { setOwnedIds(null); return }
    localStorage.setItem(COLLECTION_CODE_KEY, collectionCode)
    const timer = setTimeout(() => {
      const sinnerInfos: SinnerInfo[] = sinners.map(s => ({ id: s.id, name_kr: s.name_kr, order_num: s.order_num }))
      const idsByS: Record<string, IdentityInfo[]> = {}
      const egosByS: Record<string, EGOInfo[]> = {}
      for (const s of sinners) {
        idsByS[s.id] = identities.filter(i => i.sinner_id === s.id)
          .map(i => ({ id: i.id, sinner_id: i.sinner_id, name_kr: i.name_kr, game_id: i.game_id ?? null, folder_name: i.folder_name ?? null, rarity: i.rarity, keywords: i.keywords ?? null }))
        egosByS[s.id] = egos.filter(e => e.sinner_id === s.id)
          .map(e => ({ id: e.id, sinner_id: e.sinner_id, name_kr: e.name_kr, grade: e.grade, sin_affinity: e.sin_affinity ?? null, folder_name: e.folder_name ?? null, image_url: e.image_url ?? null }))
      }
      decodeCollectionAsync(collectionCode.trim(), sinnerInfos, idsByS, egosByS)
        .then(set => {
          if (set.size === 0) { showWarning(t('invalidCode')); setOwnedIds(null) } else setOwnedIds(set)
        })
        .catch(() => { showError(t('decodeFailed')); setOwnedIds(null) })
    }, 500)
    return () => clearTimeout(timer)
  }, [collectionEnabled, collectionCode, sinners, identities, egos, t])

  const pools = useMemo(() => {
    const map: Record<string, Identity[]> = {}
    for (const s of sinners) {
      map[s.id] = identities.filter(i =>
        i.sinner_id === s.id
        && (!collectionEnabled || ownedIds === null || ownedIds.has(i.id))
        && (rarityFilter === null || rarityFilter.has(i.rarity)))
    }
    return map
  }, [sinners, identities, ownedIds, collectionEnabled, rarityFilter])

  const egoPools = useMemo(() => {
    const map: Record<string, EGO[]> = {}
    for (const s of sinners) map[s.id] = egos.filter(e => e.sinner_id === s.id && (!collectionEnabled || ownedIds === null || ownedIds.has(e.id)))
    return map
  }, [sinners, egos, ownedIds, collectionEnabled])

  const bothOff = !identityEnabled && !egoEnabled
  const view = !identityEnabled ? 'ego' : !egoEnabled ? 'identity' : tab

  const handleRoll = useCallback(() => {
    if (isRolling) return
    if (bothOff) { showWarning(t('pickOne')); return }
    if (identityEnabled) {
      const missing = sinners.filter(s => !pools[s.id]?.length)
      if (missing.length > 0) { showError(t('noIdentity', { names: sinnerNames(missing, lang) })); return }
    }
    if (collectionEnabled && ownedIds && egoEnabled) {
      const missingZayin = sinners.filter(s => !(egoPools[s.id] ?? []).some(e => e.grade === 'ZAYIN'))
      if (missingZayin.length > 0) { showError(t('noZayin', { names: sinnerNames(missingZayin, lang) })); return }
    }
    if (keywords.length > 0 && identityEnabled && validateConditions(sinners, pools, keywords)) {
      showError(t('keywordImpossible'))
      return
    }
    setIsRolling(true)
    setDeckCode(null)
    setRerolledSinnerId(null)
    setRollId(prev => prev + 1)
    setResult(generateRandom(sinners, identities, egos, {
      identityEnabled,
      egoEnabled,
      keywords: identityEnabled ? keywords : [],
      ownedIds: collectionEnabled ? ownedIds : null,
      rarityFilter,
    }))
    clearTimeout(rollTimer.current)
    rollTimer.current = setTimeout(() => setIsRolling(false), ROLL_MS)
  }, [sinners, identities, egos, identityEnabled, egoEnabled, keywords, pools, egoPools, collectionEnabled, ownedIds, rarityFilter, bothOff, isRolling, t, lang])

  useEffect(() => () => clearTimeout(rollTimer.current), [])

  // Formation code once the cards have landed (and again after each reroll).
  useEffect(() => {
    if (isRolling || !result) return
    let cancelled = false
    encodeRandomResult(sinners, identities, egos, result).then(code => { if (!cancelled) setDeckCode(code) }).catch(() => {})
    return () => { cancelled = true }
  }, [isRolling, result, sinners, identities, egos])

  const handleReroll = useCallback((sinnerId: string) => {
    if (!result || isRolling) return
    const pool = pools[sinnerId] ?? []
    const current = result.identities[sinnerId]
    const others = pool.filter(i => i.id !== current?.id)
    if (others.length === 0) return
    const next = others[Math.floor(Math.random() * others.length)]
    setResult(prev => prev ? { ...prev, identities: { ...prev.identities, [sinnerId]: next } } : null)
    setRerolledSinnerId(sinnerId)
    setDeckCode(null)
  }, [result, pools, isRolling])

  const handleCopy = useCallback(async () => {
    if (!deckCode) return
    try { await navigator.clipboard.writeText(deckCode); showSuccess(t('copied')) } catch { showError(t('copyFailed')) }
  }, [deckCode, t])

  const actions = (
    <>
      <button type="button" onClick={handleRoll} disabled={isRolling} className={styles.roll} data-busy={isRolling || undefined}>
        <Shuffle aria-hidden="true" />{t('roll')}
      </button>
      <button type="button" onClick={handleCopy} disabled={!deckCode} className={styles.copy}>
        <Copy aria-hidden="true" />{t('copyCode')}
      </button>
    </>
  )

  return (
    <div className={styles.layout}>
      <OptionPanel
        identityEnabled={identityEnabled}
        egoEnabled={egoEnabled}
        collectionEnabled={collectionEnabled}
        collectionCode={collectionCode}
        collectionDecoded={ownedIds !== null}
        keywords={keywords}
        rarityFilter={rarityFilter}
        onIdentityToggle={() => setIdentityEnabled(p => !p)}
        onEgoToggle={() => setEgoEnabled(p => !p)}
        onCollectionToggle={() => setCollectionEnabled(p => !p)}
        onCollectionCodeChange={setCollectionCode}
        onKeywordsChange={setKeywords}
        onKeywordMaxExceeded={() => showWarning(t('keywordMax'))}
        onRarityFilterChange={setRarityFilter}
        actions={<div className={styles.actions}>{actions}</div>}
      />
      <div className={styles.main}>
        <div role="tablist" className={styles.tabs}>
          {(['identity', 'ego'] as const).map(key => (
            <button key={key} type="button" role="tab" className={styles.tab} aria-selected={view === key} aria-controls="random-board"
              disabled={key === 'identity' ? !identityEnabled : !egoEnabled} onClick={() => setTab(key)}>
              {t(key)}
            </button>
          ))}
        </div>
        <ResultGrid
          sinners={sinners}
          pools={pools}
          result={result}
          view={view}
          rollId={rollId}
          rerolledSinnerId={rerolledSinnerId}
          onReroll={handleReroll}
        />
      </div>
      <div className={styles.mobileBar}>{actions}</div>
    </div>
  )
}

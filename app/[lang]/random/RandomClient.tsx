'use client'

import { useState, useCallback, useMemo, useEffect, useRef, startTransition } from 'react'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { Copy, FastForward, Shuffle } from 'lucide-react'
import type { Sinner, Identity, EGO } from '@/lib/types'
import type { SinnerInfo, IdentityInfo, EGOInfo } from '@/lib/collection'
import type { SupportedLang } from '@/lib/i18n/types'
import type { IdentityData } from '@/lib/planner/types'
import { getLocalizedName } from '@/lib/i18n'
import { useRouter } from '@/lib/i18n/navigation'
import { decodeCollectionAsync } from '@/lib/collection'
import { identityPool, normalizeDeployRange, validateConditions } from '@/lib/random/engine'
import type { KeywordCondition } from '@/lib/random/engine'
import { encodeRandomResult } from '@/lib/random/deckCode'
import { clearRecent, pushRecent, readRecent, recentFromRoll, writeRecent, type RecentRoll } from '@/lib/random/history'
import { saveBoardImage } from '@/lib/random/image'
import type { RollSettings, RollSnapshot } from '@/lib/random/roll'
import { deckLinkFromCode, plannerStateFromCode } from '@/lib/random/send'
import { decodeSnapshot, encodeSnapshot } from '@/lib/random/share'
import { useHtmlFlag } from '@/hooks/useHtmlFlag'
import OptionPanel from '@/components/random/OptionPanel'
import RecentRolls from '@/components/random/RecentRolls'
import ResultGrid from '@/components/random/ResultGrid'
import ResultSummary from '@/components/random/ResultSummary'
import ResultToolbar from '@/components/random/ResultToolbar'
import { useRandomRoll } from '@/components/random/useRandomRoll'
import { showSuccess, showError, showWarning } from '@/lib/toast'
import styles from '@/components/random/random.module.css'

type Props = { sinners: Sinner[]; identities: Identity[]; egos: EGO[] }

const COLLECTION_CODE_KEY = 'random_collection_code'
const NO_STAMPS: Record<string, number> = {}
const NO_SINNERS: ReadonlySet<string> = new Set()

const sinnerNames = (list: Sinner[], lang: SupportedLang) => list.map(s => getLocalizedName(s, lang)).join(', ')

export default function RandomClient({ sinners, identities, egos }: Props) {
  useHtmlFlag('with-tool-screen')
  const { data: session } = useSession()
  const t = useTranslations('randomPage')
  const lang = useLocale() as SupportedLang
  const router = useRouter()
  const [identityEnabled, setIdentityEnabled] = useState(true)
  const [egoEnabled, setEgoEnabled] = useState(true)
  const [collectionEnabled, setCollectionEnabled] = useState(false)
  const [collectionCode, setCollectionCode] = useState('')
  const [keywords, setKeywords] = useState<KeywordCondition[]>([])
  const [rarityFilter, setRarityFilter] = useState<Set<number> | null>(null) // null = all
  const [orderEnabled, setOrderEnabled] = useState(false)
  const [deployMin, setDeployMin] = useState(1)
  const [deployMax, setDeployMax] = useState(12)
  const [tab, setTab] = useState<'identity' | 'ego'>('identity')

  // The collection a code stands for; kept with its code so a link waits for exactly the code it was drawn with.
  const [owned, setOwned] = useState<{ code: string; ids: Set<string> } | null>(null)
  const ownedIds = owned?.ids ?? null
  const [recent, setRecent] = useState<RecentRoll[]>([])
  const [savingImage, setSavingImage] = useState(false)
  const boardRef = useRef<HTMLOListElement>(null)
  const pendingLink = useRef<RollSnapshot | null>(null)

  const data = useMemo(() => ({ sinners, identities, egos }), [sinners, identities, egos])
  const { roll, marks, revealing, rolling, shareSnapshot, start, rerollOne, toggleMark, restore, skip } = useRandomRoll(data)
  const result = roll?.result ?? null

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
    const code = collectionCode.trim()
    if (!collectionEnabled || !code) { setOwned(null); return }
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
      decodeCollectionAsync(code, sinnerInfos, idsByS, egosByS)
        .then(set => {
          if (set.size === 0) { showWarning(t('invalidCode')); setOwned(null) } else setOwned({ code, ids: set })
        })
        .catch(() => { showError(t('decodeFailed')); setOwned(null) })
    }, 500)
    return () => clearTimeout(timer)
  }, [collectionEnabled, collectionCode, sinners, identities, egos, t])

  const pools = useMemo(() => {
    const map: Record<string, Identity[]> = {}
    for (const s of sinners) map[s.id] = identityPool(identities, s.id, collectionEnabled ? ownedIds : null, rarityFilter)
    return map
  }, [sinners, identities, ownedIds, collectionEnabled, rarityFilter])

  const egoPools = useMemo(() => {
    const map: Record<string, EGO[]> = {}
    for (const s of sinners) map[s.id] = egos.filter(e => e.sinner_id === s.id && (!collectionEnabled || ownedIds === null || ownedIds.has(e.id)))
    return map
  }, [sinners, egos, ownedIds, collectionEnabled])

  // Rerolls draw from the pool the roll was drawn with, which may differ from the options as they are now.
  const rollPools = useMemo(() => {
    if (!roll) return pools
    const { rarity } = roll.snapshot.settings
    const map: Record<string, Identity[]> = {}
    for (const s of sinners) map[s.id] = identityPool(identities, s.id, roll.ownedIds, rarity ? new Set(rarity) : null)
    return map
  }, [roll, pools, sinners, identities])

  const bothOff = !identityEnabled && !egoEnabled
  const view = !identityEnabled ? 'ego' : !egoEnabled ? 'identity' : tab

  // A link (?s=...) or a recent roll: put its options on screen, then draw it again (after the collection it names has been read).
  const applyLink = useCallback((snapshot: RollSnapshot) => {
    const { settings } = snapshot
    setIdentityEnabled(settings.identityEnabled)
    setEgoEnabled(settings.egoEnabled)
    setKeywords(settings.keywords)
    setRarityFilter(settings.rarity ? new Set(settings.rarity) : null)
    setOrderEnabled(settings.deploy !== null)
    if (settings.deploy) { setDeployMin(settings.deploy.min); setDeployMax(settings.deploy.max) }
    if (!snapshot.collectionCode) {
      pendingLink.current = null
      setCollectionEnabled(false)
      restore(snapshot, null)
      return
    }
    setCollectionCode(snapshot.collectionCode)
    setCollectionEnabled(true)
    if (owned?.code === snapshot.collectionCode) { pendingLink.current = null; restore(snapshot, owned.ids) } else pendingLink.current = snapshot
  }, [owned, restore])

  useEffect(() => {
    const snapshot = decodeSnapshot(window.location.search)
    if (snapshot) applyLink(snapshot)
    setRecent(readRecent())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const pending = pendingLink.current
    if (pending && owned && owned.code === pending.collectionCode) { pendingLink.current = null; restore(pending, owned.ids) }
  }, [owned, restore])

  // The address always names what is on screen, so the page can be shared as it is.
  useEffect(() => {
    if (!shareSnapshot) return
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${encodeSnapshot(shareSnapshot)}`)
  }, [shareSnapshot])

  // Every roll (and reroll of it) lands in this browser's recent list.
  const recentRef = useRef<RecentRoll[]>([])
  recentRef.current = recent
  useEffect(() => {
    if (!roll) return
    const next = pushRecent(recentRef.current, recentFromRoll(roll.snapshot, roll.result, sinners, Date.now()))
    setRecent(next)
    writeRecent(next)
  }, [roll, sinners])

  const handleRoll = useCallback(() => {
    if (rolling) return
    if (bothOff) { showWarning(t('pickOne')); return }
    // A locked sinner keeps what it has, so it needs nothing to draw from.
    const kept = new Set(marks.filter(id => result?.identities[id]))
    const keptEgo = new Set(marks.filter(id => result?.egos[id]?.length))
    if (identityEnabled) {
      const missing = sinners.filter(s => !kept.has(s.id) && !pools[s.id]?.length)
      if (missing.length > 0) { showError(t('noIdentity', { names: sinnerNames(missing, lang) })); return }
    }
    if (collectionEnabled && ownedIds && egoEnabled) {
      const missingZayin = sinners.filter(s => !keptEgo.has(s.id) && !(egoPools[s.id] ?? []).some(e => e.grade === 'ZAYIN'))
      if (missingZayin.length > 0) { showError(t('noZayin', { names: sinnerNames(missingZayin, lang) })); return }
    }
    if (keywords.length > 0 && identityEnabled && validateConditions(sinners, pools, keywords)) {
      showError(t('keywordImpossible'))
      return
    }
    const settings: RollSettings = {
      identityEnabled,
      egoEnabled,
      keywords: identityEnabled ? keywords : [],
      rarity: rarityFilter ? [...rarityFilter].sort() : null,
      deploy: orderEnabled && identityEnabled ? normalizeDeployRange({ min: deployMin, max: deployMax }) : null,
    }
    const rollOwned = collectionEnabled ? ownedIds : null
    // The board (twelve cards) renders as a transition so the press paints first on slow phones (INP).
    startTransition(() => start({ settings, collectionCode: rollOwned && owned ? owned.code : null, ownedIds: rollOwned }))
  }, [sinners, identityEnabled, egoEnabled, keywords, pools, egoPools, collectionEnabled, ownedIds, owned, rarityFilter, orderEnabled, deployMin, deployMax, bothOff, rolling, marks, result, start, t, lang])

  // Formation code once the cards have landed (and again after each reroll).
  const [coded, setCoded] = useState<{ result: typeof result; code: string } | null>(null)
  useEffect(() => {
    if (!result) return
    let cancelled = false
    encodeRandomResult(sinners, identities, egos, result).then(code => { if (!cancelled) setCoded({ result, code }) }).catch(() => {})
    return () => { cancelled = true }
  }, [result, sinners, identities, egos])
  const deckCode = !revealing && coded && coded.result === result ? coded.code : null

  const handleReroll = useCallback((sinnerId: string) => {
    if (!roll || rolling) return
    rerollOne(sinnerId)
  }, [roll, rolling, rerollOne])

  const handleCopy = useCallback(async () => {
    if (!deckCode) return
    try { await navigator.clipboard.writeText(deckCode); showSuccess(t('copied')) } catch { showError(t('copyFailed')) }
  }, [deckCode, t])

  const handleCopyLink = useCallback(async () => {
    if (!shareSnapshot) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?${encodeSnapshot(shareSnapshot)}`)
      showSuccess(t('linkCopied'))
    } catch { showError(t('linkCopyFailed')) }
  }, [shareSnapshot, t])

  // Planner: its own hand-off storage (read once when the planner opens, the earlier draft is offered back there). Deck builder: ?formation=.
  const sendTo = useCallback(async (target: 'planner' | 'deck') => {
    if (!result) return
    try {
      const code = await encodeRandomResult(sinners, identities, egos, result)
      if (target === 'deck') { router.push(deckLinkFromCode(code)); return }
      const state = plannerStateFromCode(code, sinners, identities as unknown as IdentityData[], egos as never)
      const { saveDraftToLocal } = await import('@/lib/planner/encoder')
      if (!state || !saveDraftToLocal(state)) throw new Error('hand-off failed')
      router.push('/planner')
      showSuccess(t('sentToPlanner'))
    } catch { showError(t('sendFailed')) }
  }, [result, sinners, identities, egos, router, t])

  const handleImage = useCallback(async () => {
    if (!boardRef.current || savingImage) return
    setSavingImage(true)
    try {
      await saveBoardImage(boardRef.current, `limbus-random-${roll?.snapshot.seed ?? 'formation'}.png`)
      showSuccess(t('imageSaved'))
    } catch { showError(t('imageFailed')) } finally { setSavingImage(false) }
  }, [roll, savingImage, t])

  const handleRestore = useCallback((entry: RecentRoll) => {
    const snapshot = decodeSnapshot(entry.q)
    if (snapshot) applyLink(snapshot)
  }, [applyLink])

  const handleClearRecent = useCallback(() => {
    clearRecent()
    setRecent([])
  }, [])

  const actions = (
    <>
      <div className={styles.rollRow}>
        <button type="button" onClick={handleRoll} disabled={rolling} className={styles.roll} data-busy={rolling || undefined}>
          <Shuffle aria-hidden="true" />{t('roll')}
        </button>
        <button type="button" onClick={skip} disabled={!revealing} className={styles.skip} aria-label={t('skip')} title={t('skip')}>
          <FastForward aria-hidden="true" />
        </button>
      </div>
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
        orderEnabled={orderEnabled}
        deployMin={deployMin}
        deployMax={deployMax}
        onIdentityToggle={() => setIdentityEnabled(p => !p)}
        onEgoToggle={() => setEgoEnabled(p => !p)}
        onCollectionToggle={() => setCollectionEnabled(p => !p)}
        onCollectionCodeChange={setCollectionCode}
        onKeywordsChange={setKeywords}
        onKeywordMaxExceeded={() => showWarning(t('keywordMax'))}
        onRarityFilterChange={setRarityFilter}
        onOrderToggle={() => setOrderEnabled(p => !p)}
        onDeployChange={(min, max) => { setDeployMin(min); setDeployMax(max) }}
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
          pools={rollPools}
          result={result}
          view={view}
          revealing={revealing}
          fresh={roll?.fresh ?? NO_SINNERS}
          stamps={roll?.stamps ?? NO_STAMPS}
          marks={marks}
          boardRef={boardRef}
          onReroll={handleReroll}
          onToggleMark={toggleMark}
        />
        <ResultSummary result={result} identityEnabled={identityEnabled} egoEnabled={egoEnabled} />
        <ResultToolbar
          disabled={!result || rolling}
          imageDisabled={view !== 'identity'}
          saving={savingImage}
          onCopyLink={handleCopyLink}
          onPlanner={() => sendTo('planner')}
          onDeck={() => sendTo('deck')}
          onImage={handleImage}
        />
        <RecentRolls recent={recent} sinners={sinners} identities={identities} currentSeed={roll?.snapshot.seed ?? null} onRestore={handleRestore} onClear={handleClearRecent} />
      </div>
      <div className={styles.mobileBar}>{actions}</div>
    </div>
  )
}

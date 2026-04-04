'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useQueryState, parseAsString } from 'nuqs'
import type { Sinner, Identity, EGO } from '@/lib/types'
import type { SinnerInfo, IdentityInfo, EGOInfo } from '@/lib/collection'
import { decodeCollectionAsync } from '@/lib/collection'
import { generateRandom, validateConditions } from '@/lib/random/engine'
import type { KeywordCondition, RandomResult } from '@/lib/random/engine'
import { encodeRandomResult } from '@/lib/random/deckCode'
import OptionPanel from '@/components/random/OptionPanel'
import ResultGrid from '@/components/random/ResultGrid'
import { showSuccess, showError, showWarning } from '@/lib/toast'
import { Copy, Shuffle } from 'lucide-react'

type Props = {
  sinners: Sinner[]
  identities: Identity[]
  egos: EGO[]
  /** Pre-resolved ?code= param from the URL (passed by RandomInteractive) */
  urlCode?: string
}

const COLLECTION_CODE_KEY = 'random_collection_code'

export default function RandomClient({ sinners, identities, egos, urlCode }: Props) {
  const { data: session } = useSession()
  // Options
  const [identityEnabled, setIdentityEnabled] = useState(true)
  const [egoEnabled, setEgoEnabled] = useState(true)
  const [collectionEnabled, setCollectionEnabled] = useState(false)
  const [collectionCode, setCollectionCode] = useState('')
  const [keywords, setKeywords] = useState<KeywordCondition[]>([])
  const [rarityFilter, setRarityFilter] = useState<Set<number> | null>(null) // null = all

  // Tab
  const [activeTabParam, setActiveTab] = useQueryState('tab', parseAsString.withDefault('identity'))
  const activeTab = (activeTabParam as 'identity' | 'ego') || 'identity'

  // Result
  const [result, setResult] = useState<RandomResult | null>(null)
  const [rollId, setRollId] = useState(0)
  const [rerolledSinnerId, setRerolledSinnerId] = useState<string | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [deckCode, setDeckCode] = useState<string | null>(null)

  // Collection
  const [ownedIds, setOwnedIds] = useState<Set<string> | null>(null)

  // Auto-switch tab when only one mode is enabled
  useEffect(() => {
    if (!identityEnabled && egoEnabled) setActiveTab('ego')
    if (identityEnabled && !egoEnabled) setActiveTab('identity')
  }, [identityEnabled, egoEnabled])

  // Load collection code: URL param > localStorage
  // Only auto-enable for explicit ?code= URL param
  useEffect(() => {
    if (urlCode) {
      const decoded = decodeURIComponent(urlCode)
      setCollectionCode(decoded)
      setCollectionEnabled(true)
      return
    }
    const saved = localStorage.getItem(COLLECTION_CODE_KEY)
    if (saved) {
      setCollectionCode(saved)
    }
  }, [urlCode])

  // Pre-load collection code for logged-in users (does not auto-enable)
  useEffect(() => {
    if (urlCode) return
    if (collectionCode) return  // already have a code
    if (!session?.user?.email) return
    ;(async () => {
      try {
        const res = await fetch('/api/profile')
        if (!res.ok) return
        const { profile } = await res.json()
        if (profile?.collection_code) {
          setCollectionCode(profile.collection_code)
        }
      } catch { /* ignore */ }
    })()
  }, [session?.user?.email, urlCode, collectionCode])

  // Decode collection code (debounced)
  useEffect(() => {
    if (!collectionEnabled || !collectionCode.trim()) {
      setOwnedIds(null)
      return
    }
    localStorage.setItem(COLLECTION_CODE_KEY, collectionCode)

    const timer = setTimeout(() => {
      const sinnerInfos: SinnerInfo[] = sinners.map(s => ({ id: s.id, name_kr: s.name_kr, order_num: s.order_num }))
      const idsByS: Record<string, IdentityInfo[]> = {}
      const egosByS: Record<string, EGOInfo[]> = {}
      for (const s of sinners) {
        idsByS[s.id] = identities
          .filter(i => i.sinner_id === s.id)
          .map(i => ({ id: i.id, sinner_id: i.sinner_id, name_kr: i.name_kr, game_id: i.game_id ?? null, folder_name: i.folder_name ?? null, rarity: i.rarity, keywords: i.keywords ?? null }))
        egosByS[s.id] = egos
          .filter(e => e.sinner_id === s.id)
          .map(e => ({ id: e.id, sinner_id: e.sinner_id, name_kr: e.name_kr, grade: e.grade, sin_affinity: e.sin_affinity ?? null, folder_name: e.folder_name ?? null, image_url: e.image_url ?? null }))
      }

      decodeCollectionAsync(collectionCode.trim(), sinnerInfos, idsByS, egosByS)
        .then(set => {
          if (set.size === 0) {
            showWarning('컬렉션 코드가 유효하지 않습니다')
            setOwnedIds(null)
          } else {
            setOwnedIds(set)
          }
        })
        .catch(() => {
          showError('컬렉션 코드 디코딩 실패')
          setOwnedIds(null)
        })
    }, 500)

    return () => clearTimeout(timer)
  }, [collectionEnabled, collectionCode, sinners, identities, egos])

  // Per-sinner identity pools
  const pools = useMemo(() => {
    const map: Record<string, Identity[]> = {}
    for (const s of sinners) {
      map[s.id] = identities.filter(i =>
        i.sinner_id === s.id
        && (!collectionEnabled || ownedIds === null || ownedIds.has(i.id))
        && (rarityFilter === null || rarityFilter.has(i.rarity))
      )
    }
    return map
  }, [sinners, identities, ownedIds, collectionEnabled, rarityFilter])

  const bothOff = !identityEnabled && !egoEnabled

  // EGO pools (for validation)
  const egoPools = useMemo(() => {
    const map: Record<string, EGO[]> = {}
    for (const s of sinners) {
      map[s.id] = egos.filter(e =>
        e.sinner_id === s.id && (!collectionEnabled || ownedIds === null || ownedIds.has(e.id))
      )
    }
    return map
  }, [sinners, egos, ownedIds, collectionEnabled])

  // Roll
  const handleRoll = useCallback(() => {
    if (bothOff || isRolling) return

    // Validation: every sinner needs ≥1 identity in pool
    if (identityEnabled) {
      const missing = sinners.filter(s => !pools[s.id]?.length)
      if (missing.length > 0) {
        const reason = rarityFilter ? '해당 등급의 ' : ''
        showError(`${missing.map(s => s.name_kr).join(', ')}에게 ${reason}인격이 없습니다`)
        return
      }
    }

    // Collection validation: ZAYIN EGO
    if (collectionEnabled && ownedIds) {
      if (egoEnabled) {
        const missingZayin = sinners.filter(s => {
          const pool = egoPools[s.id] ?? []
          return !pool.some(e => e.grade === 'ZAYIN')
        })
        if (missingZayin.length > 0) {
          showError(`${missingZayin.map(s => s.name_kr).join(', ')}의 ZAYIN E.G.O가 컬렉션에 없습니다`)
          return
        }
      }
    }

    if (keywords.length > 0 && identityEnabled) {
      const error = validateConditions(sinners, pools, keywords)
      if (error) {
        showError(error)
        return
      }
    }

    setIsRolling(true)
    setRevealed(false)
    setDeckCode(null)
    setRerolledSinnerId(null)
    setRollId(prev => prev + 1)

    const newResult = generateRandom(sinners, identities, egos, {
      identityEnabled,
      egoEnabled,
      keywords: identityEnabled ? keywords : [],
      ownedIds: collectionEnabled ? ownedIds : null,
      rarityFilter,
    })
    setResult(newResult)
  }, [sinners, identities, egos, identityEnabled, egoEnabled, keywords, pools, egoPools, collectionEnabled, ownedIds, bothOff, isRolling])

  // Reveal done
  const handleRevealDone = useCallback(() => {
    setIsRolling(false)
    setRevealed(true)
  }, [])

  // Generate deck code after reveal
  useEffect(() => {
    if (!revealed || !result) return
    encodeRandomResult(sinners, identities, egos, result)
      .then(code => setDeckCode(code))
      .catch(() => {})
  }, [revealed, result, sinners, identities, egos])

  // Reroll single sinner
  const handleReroll = useCallback((sinnerId: string) => {
    if (!result || isRolling) return
    const pool = pools[sinnerId]
    if (pool.length <= 1) return
    const cur = result.identities[sinnerId]
    let newIdentity = pool[Math.floor(Math.random() * pool.length)]
    if (pool.length > 1) {
      while (newIdentity.id === cur?.id) {
        newIdentity = pool[Math.floor(Math.random() * pool.length)]
      }
    }
    setResult(prev => prev ? {
      ...prev,
      identities: { ...prev.identities, [sinnerId]: newIdentity },
    } : null)
    setRerolledSinnerId(sinnerId)
    setDeckCode(null)
  }, [result, pools, isRolling])

  // Copy deck code
  const handleCopy = useCallback(async () => {
    if (!deckCode) return
    await navigator.clipboard.writeText(deckCode)
    showSuccess('편성코드가 복사되었습니다')
  }, [deckCode])

  const showTabs = identityEnabled && egoEnabled

  return (
    <>
        {/* Options */}
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
          onKeywordMaxExceeded={() => showWarning('키워드는 최대 2개까지 선택할 수 있습니다')}
          onRarityFilterChange={setRarityFilter}
        />

        {/* Tabs */}
        {showTabs && result && (
          <div className="flex gap-0 mb-[1rem]" style={{ borderBottom: '1px solid rgba(138,96,16,0.15)' }}>
            <TabButton label="인격" active={activeTab === 'identity'} onClick={() => setActiveTab('identity')} />
            <TabButton label="E.G.O" active={activeTab === 'ego'} onClick={() => setActiveTab('ego')} />
          </div>
        )}

        {/* Results with atmospheric backdrop */}
        <div className="relative">
          {/* Atmospheric glow behind grid */}
          {result && revealed && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at 50% 30%, rgba(200,144,10,0.04) 0%, transparent 60%)',
                filter: 'blur(40px)',
              }}
            />
          )}
          <ResultGrid
            sinners={sinners}
            pools={pools}
            result={result}
            activeTab={showTabs ? activeTab : (identityEnabled ? 'identity' : 'ego')}
            rollId={rollId}
            rerolledSinnerId={rerolledSinnerId}
            revealed={revealed}
            onRevealDone={handleRevealDone}
            onReroll={handleReroll}
          />
        </div>

        {/* Roll button + Copy */}
        <div className="flex items-center justify-center gap-[0.75rem] mt-[2rem] max-md:hidden">
          <button
            onClick={handleRoll}
            disabled={bothOff}
            className={`flex items-center gap-[0.5rem] px-[2rem] py-[0.75rem] rounded-[0.375rem] font-serif text-[1.125rem] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] ${!bothOff && !isRolling ? 'animate-roll-glow' : ''}`}
            style={{
              background: bothOff || isRolling ? '#3a3020' : 'linear-gradient(135deg, #b88008 0%, #e8b030 50%, #c8900a 100%)',
              color: bothOff || isRolling ? '#5a5040' : '#0d0b08',
              boxShadow: bothOff || isRolling ? 'none' : undefined,
              letterSpacing: '0.05em',
            }}
          >
            <Shuffle style={{ width: '1.125rem', height: '1.125rem', animation: isRolling ? 'spin-slow 0.6s linear infinite' : 'none' }} />
            랜덤
          </button>
          {deckCode && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-[0.375rem] px-[0.875rem] py-[0.75rem] rounded-[0.375rem] text-[0.8125rem] transition-all duration-200 hover:brightness-125 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'rgba(200,144,10,0.1)',
                color: '#c8900a',
                border: '1px solid rgba(200,144,10,0.3)',
                boxShadow: '0 0 0.75rem rgba(200,144,10,0.05)',
              }}
            >
              <Copy style={{ width: '0.875rem', height: '0.875rem' }} />
              편성코드 복사
            </button>
          )}
        </div>

        {bothOff && (
          <div className="flex items-center justify-center gap-[0.375rem] mt-[0.75rem] py-[0.5rem] rounded-[0.25rem]" style={{ background: 'rgba(90,60,20,0.08)', border: '1px dashed rgba(138,96,16,0.15)' }}>
            <p className="text-[0.8125rem] text-[#5a4830]">인격 또는 E.G.O 중 하나 이상 선택해주세요</p>
          </div>
        )}

        {/* Mobile sticky bottom */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-[0.75rem] px-[1rem] py-[0.75rem]" style={{ background: 'rgba(13,11,8,0.97)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(138,96,16,0.2)', boxShadow: '0 -0.5rem 2rem rgba(0,0,0,0.4)' }}>
          <button
            onClick={handleRoll}
            disabled={bothOff}
            className="flex items-center gap-[0.375rem] px-[1.5rem] py-[0.625rem] rounded-[0.375rem] font-serif text-[1rem] transition-all disabled:opacity-40 active:scale-[0.97]"
            style={{
              background: bothOff || isRolling ? '#3a3020' : 'linear-gradient(135deg, #b88008, #e8b030, #c8900a)',
              color: bothOff || isRolling ? '#5a5040' : '#0d0b08',
              boxShadow: bothOff || isRolling ? 'none' : '0 0 1rem rgba(200,144,10,0.25)',
              letterSpacing: '0.05em',
            }}
          >
            <Shuffle style={{ width: '1rem', height: '1rem', animation: isRolling ? 'spin-slow 0.6s linear infinite' : 'none' }} />
            랜덤
          </button>
          {deckCode && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-[0.25rem] px-[0.875rem] py-[0.625rem] rounded-[0.375rem] text-[0.8125rem] transition-all active:scale-[0.97]"
              style={{ background: 'rgba(200,144,10,0.1)', color: '#c8900a', border: '1px solid rgba(200,144,10,0.25)' }}
            >
              <Copy style={{ width: '0.875rem', height: '0.875rem' }} />
              복사
            </button>
          )}
        </div>
    </>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-[1.25rem] py-[0.625rem] text-[0.875rem] transition-all duration-200 relative"
      style={{
        fontFamily: 'var(--font-heading)',
        color: active ? '#e8b030' : '#5a5040',
        background: active ? 'rgba(200,144,10,0.06)' : 'none',
        borderBottom: active ? '2px solid #c8900a' : '2px solid transparent',
        letterSpacing: '0.03em',
      }}
    >
      {label}
      {active && (
        <div className="absolute bottom-0 inset-x-[20%] h-[0.0625rem]" style={{ background: 'radial-gradient(ellipse, rgba(232,176,48,0.4), transparent)', filter: 'blur(2px)' }} />
      )}
    </button>
  )
}

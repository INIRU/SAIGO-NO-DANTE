'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import type { Sinner, Identity, EGO } from '@/lib/types'
import type { SinnerInfo, IdentityInfo, EGOInfo } from '@/lib/collection'
import { decodeCollectionAsync } from '@/lib/collection'
import { generateRandom, validateConditions } from '@/lib/random/engine'
import type { KeywordCondition, RandomResult } from '@/lib/random/engine'
import { encodeRandomResult } from '@/lib/random/deckCode'
import OptionPanel from '@/components/random/OptionPanel'
import ResultGrid from '@/components/random/ResultGrid'
import { useToast, Toast } from '@/components/ui/Toast'
import { Copy, Shuffle } from 'lucide-react'

type Props = {
  sinners: Sinner[]
  identities: Identity[]
  egos: EGO[]
}

const COLLECTION_CODE_KEY = 'random_collection_code'

export default function RandomClient({ sinners, identities, egos }: Props) {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const { toast, showToast } = useToast()

  // Options
  const [identityEnabled, setIdentityEnabled] = useState(true)
  const [egoEnabled, setEgoEnabled] = useState(true)
  const [collectionEnabled, setCollectionEnabled] = useState(false)
  const [collectionCode, setCollectionCode] = useState('')
  const [keywords, setKeywords] = useState<KeywordCondition[]>([])

  // Tab
  const [activeTab, setActiveTab] = useState<'identity' | 'ego'>('identity')

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

  // Load collection code: URL param > logged-in profile > localStorage
  useEffect(() => {
    const urlCode = searchParams.get('code')
    if (urlCode) {
      const decoded = decodeURIComponent(urlCode)
      setCollectionCode(decoded)
      setCollectionEnabled(true)
      return
    }
    const saved = localStorage.getItem(COLLECTION_CODE_KEY)
    if (saved) {
      setCollectionCode(saved)
      setCollectionEnabled(true)
    }
  }, [searchParams])

  // Auto-load collection for logged-in users (if no URL code)
  useEffect(() => {
    if (searchParams.get('code')) return
    if (!session?.user?.email) return
    ;(async () => {
      try {
        const res = await fetch('/api/profile')
        if (!res.ok) return
        const { profile } = await res.json()
        if (profile?.collection_code) {
          setCollectionCode(profile.collection_code)
          setCollectionEnabled(true)
        }
      } catch { /* ignore */ }
    })()
  }, [session?.user?.email, searchParams])

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
            showToast('컬렉션 코드가 유효하지 않습니다', 'warning')
            setOwnedIds(null)
          } else {
            setOwnedIds(set)
          }
        })
        .catch(() => {
          showToast('컬렉션 코드 디코딩 실패', 'error')
          setOwnedIds(null)
        })
    }, 500)

    return () => clearTimeout(timer)
  }, [collectionEnabled, collectionCode, sinners, identities, egos, showToast])

  // Per-sinner identity pools
  const pools = useMemo(() => {
    const map: Record<string, Identity[]> = {}
    for (const s of sinners) {
      map[s.id] = identities.filter(i =>
        i.sinner_id === s.id && (!collectionEnabled || ownedIds === null || ownedIds.has(i.id))
      )
    }
    return map
  }, [sinners, identities, ownedIds, collectionEnabled])

  const bothOff = !identityEnabled && !egoEnabled

  // Roll
  const handleRoll = useCallback(() => {
    if (bothOff || isRolling) return

    if (keywords.length > 0 && identityEnabled) {
      const error = validateConditions(sinners, pools, keywords)
      if (error) {
        showToast(error, 'error')
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
    })
    setResult(newResult)
  }, [sinners, identities, egos, identityEnabled, egoEnabled, keywords, pools, collectionEnabled, ownedIds, bothOff, isRolling, showToast])

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
    showToast('편성코드가 복사되었습니다', 'success')
  }, [deckCode, showToast])

  const showTabs = identityEnabled && egoEnabled

  return (
    <div style={{ paddingTop: '64px' }}>
      <div className="mx-auto max-w-[80rem] px-[1rem] py-[2rem] pb-[6rem] md:pb-[2rem]">
        {/* Header */}
        <div className="flex items-center justify-between mb-[1.5rem]" style={{ borderBottom: '1px solid rgba(138,96,16,0.2)', paddingBottom: '1rem' }}>
          <h1 className="font-serif text-[1.75rem] text-[#c8900a]">랜덤 편성</h1>
          {deckCode && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-[0.375rem] px-[0.875rem] py-[0.5rem] rounded-[0.25rem] text-[0.8125rem] transition-all duration-200 hover:brightness-110"
              style={{
                background: 'rgba(200,144,10,0.15)',
                color: '#c8900a',
                border: '1px solid rgba(200,144,10,0.4)',
              }}
            >
              <Copy style={{ width: '0.875rem', height: '0.875rem' }} />
              편성코드 복사
            </button>
          )}
        </div>

        {/* Options */}
        <OptionPanel
          identityEnabled={identityEnabled}
          egoEnabled={egoEnabled}
          collectionEnabled={collectionEnabled}
          collectionCode={collectionCode}
          collectionDecoded={ownedIds !== null}
          keywords={keywords}
          onIdentityToggle={() => setIdentityEnabled(p => !p)}
          onEgoToggle={() => setEgoEnabled(p => !p)}
          onCollectionToggle={() => setCollectionEnabled(p => !p)}
          onCollectionCodeChange={setCollectionCode}
          onKeywordsChange={setKeywords}
          onKeywordMaxExceeded={() => showToast('키워드는 최대 2개까지 선택할 수 있습니다', 'warning')}
        />

        {/* Tabs */}
        {showTabs && result && (
          <div className="flex gap-0 mb-[1rem]" style={{ borderBottom: '1px solid rgba(138,96,16,0.15)' }}>
            <TabButton label="인격" active={activeTab === 'identity'} onClick={() => setActiveTab('identity')} />
            <TabButton label="E.G.O" active={activeTab === 'ego'} onClick={() => setActiveTab('ego')} />
          </div>
        )}

        {/* Results */}
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

        {/* Roll button */}
        <div className="flex items-center justify-center gap-[0.75rem] mt-[2rem] max-md:hidden">
          <button
            onClick={handleRoll}
            disabled={bothOff || isRolling}
            className="flex items-center gap-[0.5rem] px-[2rem] py-[0.75rem] rounded-[0.25rem] font-serif text-[1.125rem] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
            style={{
              background: bothOff || isRolling ? '#3a3020' : 'linear-gradient(135deg, #c8900a, #e8b030)',
              color: bothOff || isRolling ? '#5a5040' : '#0d0b08',
              boxShadow: bothOff || isRolling ? 'none' : '0 0 1.5rem rgba(200,144,10,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            <Shuffle style={{ width: '1.125rem', height: '1.125rem' }} />
            {result ? '다시 돌리기' : '돌리기'}
          </button>
        </div>

        {bothOff && (
          <p className="text-center text-[0.8125rem] text-[#5a5040] mt-[0.5rem]">인격 또는 E.G.O 중 하나 이상 선택해주세요</p>
        )}

        {/* Mobile sticky bottom */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-[0.75rem] px-[1rem] py-[0.75rem]" style={{ background: 'rgba(13,11,8,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(138,96,16,0.2)' }}>
          <button
            onClick={handleRoll}
            disabled={bothOff || isRolling}
            className="flex items-center gap-[0.375rem] px-[1.5rem] py-[0.625rem] rounded-[0.25rem] font-serif text-[1rem] transition-all disabled:opacity-40"
            style={{
              background: bothOff || isRolling ? '#3a3020' : 'linear-gradient(135deg, #c8900a, #e8b030)',
              color: bothOff || isRolling ? '#5a5040' : '#0d0b08',
            }}
          >
            <Shuffle style={{ width: '1rem', height: '1rem' }} />
            {result ? '다시' : '돌리기'}
          </button>
          {deckCode && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-[0.25rem] px-[0.875rem] py-[0.625rem] rounded-[0.25rem] text-[0.8125rem] transition-colors"
              style={{ background: 'rgba(200,144,10,0.15)', color: '#c8900a', border: '1px solid rgba(200,144,10,0.3)' }}
            >
              <Copy style={{ width: '0.875rem', height: '0.875rem' }} />
              복사
            </button>
          )}
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-[1.25rem] py-[0.625rem] text-[0.875rem] transition-colors duration-200"
      style={{
        fontFamily: 'var(--font-heading)',
        color: active ? '#c8900a' : '#555566',
        borderBottom: active ? '2px solid #c8900a' : '2px solid transparent',
        background: 'none',
      }}
    >
      {label}
    </button>
  )
}

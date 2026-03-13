'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import type { Sinner, Identity, EGO } from '@/lib/types'
import type { SinnerInfo, IdentityInfo, EGOInfo } from '@/lib/collection'
import { decodeCollectionAsync } from '@/lib/collection'
import { generateRandom, validateConditions } from '@/lib/random/engine'
import type { KeywordCondition, RandomResult } from '@/lib/random/engine'
import { encodeRandomResult } from '@/lib/random/deckCode'
import OptionPanel from '@/components/random/OptionPanel'
import SlotMachine from '@/components/random/SlotMachine'
import { useToast, Toast } from '@/components/ui/Toast'
import { Copy } from 'lucide-react'

type Props = {
  sinners: Sinner[]
  identities: Identity[]
  egos: EGO[]
}

const COLLECTION_CODE_KEY = 'random_collection_code'

export default function RandomClient({ sinners, identities, egos }: Props) {
  const { data: session } = useSession()
  const { toast, showToast } = useToast()

  // Options state
  const [identityEnabled, setIdentityEnabled] = useState(true)
  const [egoEnabled, setEgoEnabled] = useState(true)
  const [collectionEnabled, setCollectionEnabled] = useState(false)
  const [collectionCode, setCollectionCode] = useState('')
  const [keywords, setKeywords] = useState<KeywordCondition[]>([])

  // Result state
  const [result, setResult] = useState<RandomResult | null>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const [showEgo, setShowEgo] = useState(false)
  const [deckCode, setDeckCode] = useState<string | null>(null)

  // Owned IDs from collection
  const [ownedIds, setOwnedIds] = useState<Set<string> | null>(null)

  // Stop tracking
  const stoppedCount = useRef(0)

  // Load collection code from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(COLLECTION_CODE_KEY)
    if (saved) {
      setCollectionCode(saved)
      setCollectionEnabled(true)
    }
  }, [])

  // Auto-load collection for logged-in users
  useEffect(() => {
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
  }, [session?.user?.email])

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
    if (bothOff || isSpinning) return

    if (keywords.length > 0 && identityEnabled) {
      const error = validateConditions(sinners, pools, keywords)
      if (error) {
        showToast(error, 'error')
        return
      }
    }

    stoppedCount.current = 0
    setIsSpinning(true)
    setShowEgo(false)
    setDeckCode(null)

    const newResult = generateRandom(sinners, identities, egos, {
      identityEnabled,
      egoEnabled,
      keywords: identityEnabled ? keywords : [],
      ownedIds: collectionEnabled ? ownedIds : null,
    })
    setResult(newResult)
  }, [sinners, identities, egos, identityEnabled, egoEnabled, keywords, pools, collectionEnabled, ownedIds, bothOff, isSpinning, showToast])

  // When a single reel stops
  const handleReelStopped = useCallback(() => {
    stoppedCount.current++
    if (stoppedCount.current >= sinners.length) {
      setIsSpinning(false)
      setTimeout(() => setShowEgo(true), 500)
    }
  }, [sinners.length])

  // Generate deck code after spinning ends
  useEffect(() => {
    if (isSpinning || !result) return
    encodeRandomResult(sinners, identities, egos, result)
      .then(code => setDeckCode(code))
      .catch(() => {})
  }, [isSpinning, result, sinners, identities, egos])

  // Reroll single sinner
  const handleReroll = useCallback((sinnerId: string) => {
    if (!result || isSpinning) return
    const pool = pools[sinnerId]
    if (pool.length <= 1) return
    const newIdentity = pool[Math.floor(Math.random() * pool.length)]
    setResult(prev => prev ? {
      ...prev,
      identities: { ...prev.identities, [sinnerId]: newIdentity },
    } : null)
    setDeckCode(null)
  }, [result, pools, isSpinning])

  // Copy deck code
  const handleCopy = useCallback(async () => {
    if (!deckCode) return
    await navigator.clipboard.writeText(deckCode)
    showToast('편성코드가 복사되었습니다', 'success')
  }, [deckCode, showToast])

  return (
    <main id="main-content" className="mx-auto max-w-[80rem] px-[1rem] py-[2rem] pb-[5rem] md:pb-[2rem]">
      <h1 className="font-serif text-[2rem] text-[#c8900a] mb-[1.5rem]">랜덤 편성</h1>

      <OptionPanel
        identityEnabled={identityEnabled}
        egoEnabled={egoEnabled}
        collectionEnabled={collectionEnabled}
        collectionCode={collectionCode}
        keywords={keywords}
        onIdentityToggle={() => setIdentityEnabled(p => !p)}
        onEgoToggle={() => setEgoEnabled(p => !p)}
        onCollectionToggle={() => setCollectionEnabled(p => !p)}
        onCollectionCodeChange={setCollectionCode}
        onKeywordsChange={setKeywords}
        onKeywordMaxExceeded={() => showToast('키워드는 최대 2개까지 선택할 수 있습니다', 'warning')}
      />

      <SlotMachine
        sinners={sinners}
        pools={pools}
        result={result}
        egoEnabled={egoEnabled}
        isSpinning={isSpinning}
        showEgo={showEgo}
        onReelStopped={handleReelStopped}
        onReroll={handleReroll}
      />

      {/* Action buttons — sticky on mobile */}
      <div className="flex items-center justify-center gap-[1rem] mt-[2rem] max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:bg-[#0d0b08]/95 max-md:backdrop-blur max-md:px-[1rem] max-md:py-[0.75rem] max-md:border-t max-md:border-[#8a6010]/20 max-md:z-40">
        <button
          onClick={handleRoll}
          disabled={bothOff || isSpinning}
          className="relative px-[2.5rem] py-[0.875rem] rounded-lg font-serif text-[1.25rem] text-[#0d0b08] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: bothOff || isSpinning ? '#5a5040' : 'linear-gradient(135deg, #c8900a, #e8b030)',
            boxShadow: bothOff || isSpinning ? 'none' : '0 0 1.5rem #c8900a44',
          }}
          aria-label="랜덤 편성 시작"
        >
          돌리기
        </button>

        {deckCode && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-[0.375rem] px-[1rem] py-[0.875rem] rounded-lg border border-[#8a6010]/40 text-[0.875rem] text-[#e8b030] hover:bg-[#241c12] transition-colors"
          >
            <Copy style={{ width: '1rem', height: '1rem' }} />
            편성코드 복사
          </button>
        )}
      </div>

      {bothOff && (
        <p className="text-center text-[0.8125rem] text-[#5a5040] mt-[0.5rem]">인격 또는 E.G.O 중 하나 이상 선택해주세요</p>
      )}

      <Toast toast={toast} />
    </main>
  )
}

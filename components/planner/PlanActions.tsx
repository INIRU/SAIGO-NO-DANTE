'use client'

import { useState } from 'react'
import { useRouter } from '@/lib/i18n/navigation'
import { Copy, GitFork, Pencil, Trash2, Check, Play } from 'lucide-react'
import { saveDraftToLocal, savePlanForRun } from '@/lib/planner/encoder'
import { encodeDeckCode } from '@/components/deck-builder/deckCodeUtils'
import { showSuccess, showError } from '@/lib/toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import type { Difficulty, FloorDifficulty, IdentitySlot as PlannerIdentitySlot, EgoSlot as PlannerEgoSlot, FloorEntry as PlannerFloorEntry } from '@/lib/planner/types'
import { getLegacyPlanFloorDifficulty, isAllowedFloorDifficulty, isFloorDifficulty } from '@/lib/planner/floor-difficulty'
import type { Sinner as CanonicalSinner, Identity as CanonicalIdentity, EGO as CanonicalEGO } from '@/lib/types'

type IdentitySlot = {
  identity_id?: string
  sinner_id?: string
  name_kr?: string
  rarity?: number
  keywords?: string[]
  game_id?: string | null
  folder_name?: string | null
  slot_order?: number
}

type EgoSlot = {
  ego_id?: string
  sinner_id?: string
  name_kr?: string
  grade?: string
}

type FloorEntry = {
  floor: number
  difficulty?: FloorDifficulty
  theme_id: string | null
  gift_ids: string[]
  memo: string
}

type IdentityData = {
  id: string
  sinner_id: string
  name_kr: string
  rarity: number
  keywords: string[] | null
  game_id: string | null
  folder_name: string | null
}

type SinnerData = {
  id: string
  name_kr: string
  order_num: number
}

type EgoData = {
  id: string
  sinner_id: string
  name: string
  name_kr: string | null
  grade: string
  sin_affinity: string | null
  image_url: string | null
  cost: number[] | null
  game_id?: string | null
}

interface Props {
  planId: string
  planTitle: string
  planDescription: string | null
  difficulty: Difficulty
  deck: IdentitySlot[]
  egoSlots: EgoSlot[]
  floorPlan: FloorEntry[]
  giftInventory: string[]
  identities: IdentityData[]
  sinners: SinnerData[]
  egos: EgoData[]
  isOwner: boolean
  isAdmin: boolean
}

export default function PlanActions({
  planId,
  planTitle,
  planDescription,
  difficulty,
  deck,
  egoSlots,
  floorPlan,
  giftInventory,
  identities,
  sinners,
  egos,
  isOwner,
  isAdmin,
}: Props) {
  const router = useRouter()
  const [codeCopied, setCodeCopied] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const handleCopyCode = async () => {
    try {
      const deckSlots: Record<string, typeof identities[0] | undefined> = {}
      const egoSlotsMap: Record<string, Record<string, typeof egos[0]>> = {}
      const formationOrder: string[] = []

      const formed = deck
        .filter(s => (s.slot_order ?? 99) < 99)
        .sort((a, b) => (a.slot_order ?? 99) - (b.slot_order ?? 99))
      for (const slot of formed) {
        if (!slot.sinner_id || !slot.identity_id) continue
        const ident = identities.find(i => i.id === slot.identity_id)
        if (ident) deckSlots[slot.sinner_id] = ident
        if ((slot.slot_order ?? 99) < 7) formationOrder.push(slot.sinner_id)
      }

      for (const slot of egoSlots) {
        if (!slot.sinner_id || !slot.ego_id || !slot.grade) continue
        const ego = egos.find(e => e.id === slot.ego_id)
        if (ego) {
          if (!egoSlotsMap[slot.sinner_id]) egoSlotsMap[slot.sinner_id] = {}
          egoSlotsMap[slot.sinner_id][slot.grade] = ego
        }
      }

      const code = await encodeDeckCode(
        sinners as unknown as CanonicalSinner[],
        identities as unknown as CanonicalIdentity[],
        egos as unknown as CanonicalEGO[],
        deckSlots as Record<string, CanonicalIdentity | undefined>,
        egoSlotsMap as Record<string, Record<string, CanonicalEGO>>,
        formationOrder,
      )
      await navigator.clipboard.writeText(code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      showError('편성코드 복사 실패')
    }
  }

  const handleFork = () => {
    const planState = {
      difficulty,
      title: `${planTitle} (Fork)`,
      description: planDescription ?? '',
      identitySlots: deck,
      egoSlots,
      floorPlan,
      giftInventory,
      activeTab: 'deck' as const,
    }
    saveDraftToLocal({
      ...planState,
      identitySlots: planState.identitySlots as PlannerIdentitySlot[],
      egoSlots: planState.egoSlots as PlannerEgoSlot[],
      floorPlan: planState.floorPlan as PlannerFloorEntry[],
    })
    router.push('/planner')
    showSuccess('플래너에 불러왔습니다')
  }

  const handleRunMode = () => {
    savePlanForRun({
      difficulty,
      title: planTitle ?? '',
      description: planDescription ?? '',
      identitySlots: deck as PlannerIdentitySlot[],
      egoSlots: egoSlots as PlannerEgoSlot[],
      floorPlan: floorPlan.map((e, i: number) => ({
        floor: i + 1,
        difficulty: isFloorDifficulty(e?.difficulty) && isAllowedFloorDifficulty(e.difficulty, i + 1) ? e.difficulty : getLegacyPlanFloorDifficulty(difficulty, i + 1),
        theme_id: e?.theme_id ?? null,
        gift_ids: e?.gift_ids ?? [],
        memo: e?.memo ?? '',
      })),
      giftInventory,
      activeTab: 'deck' as const,
    })
    window.location.href = '/planner/run?from-plan=1'
  }

  const handleEdit = () => {
    saveDraftToLocal({
      difficulty,
      title: planTitle,
      description: planDescription ?? '',
      identitySlots: deck as PlannerIdentitySlot[],
      egoSlots: egoSlots as PlannerEgoSlot[],
      floorPlan: floorPlan as PlannerFloorEntry[],
      giftInventory,
      activeTab: 'deck',
    })
    router.push(`/planner?edit=${planId}`)
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/planner/${planId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/planner/community')
      } else {
        const data = await res.json()
        showError(data.error ?? '삭제 실패')
      }
    } catch {
      showError('삭제 중 오류 발생')
    }
    setShowDeleteModal(false)
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={handleCopyCode}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.75rem',
            background: codeCopied ? 'rgba(34,197,94,0.12)' : 'transparent',
            border: `1px solid ${codeCopied ? 'rgba(34,197,94,0.4)' : '#333'}`,
            borderRadius: '0.375rem', color: codeCopied ? '#4ade80' : '#9ca3af',
            fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {codeCopied ? <Check size={12} /> : <Copy size={12} />}
          {codeCopied ? '복사 완료' : '편성코드 복사'}
        </button>

        <button
          onClick={handleFork}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.75rem',
            background: 'transparent', border: '1px solid #333', borderRadius: '0.375rem',
            color: '#9ca3af', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <GitFork size={12} /> Fork
        </button>

        <button
          onClick={handleRunMode}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.75rem',
            background: '#c8900a', borderRadius: '0.375rem', color: '#0d0b08',
            fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <Play size={12} /> 트리거 모드
        </button>

        {(isOwner || isAdmin) && (
          <>
            <button
              onClick={handleEdit}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.75rem',
                background: 'transparent', border: '1px solid rgba(200,144,10,0.3)', borderRadius: '0.375rem',
                color: '#c8900a', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <Pencil size={12} /> 수정
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.75rem',
                background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.375rem',
                color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <Trash2 size={12} /> 삭제
            </button>
          </>
        )}
      </div>

      <ConfirmModal
        open={showDeleteModal}
        title="플랜 삭제"
        message="이 플랜을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </>
  )
}

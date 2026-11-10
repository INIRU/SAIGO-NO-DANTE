'use client'

import { useState } from 'react'
import { useRouter } from '@/lib/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Copy, GitFork, Pencil, Trash2, Check, Play } from 'lucide-react'
import { saveDraftToLocal, savePlanForRun } from '@/features/planner/lib/encoder'
import { showSuccess, showError } from '@/lib/toast'
import { guestHeaders, getGuestCopy } from '@/features/account'
import ConfirmModal from '@/components/ui/ConfirmModal'
import GuestPinRecover from '@/features/account/components/GuestPinRecover'
import type { Difficulty, FloorDifficulty, IdentitySlot as PlannerIdentitySlot, EgoSlot as PlannerEgoSlot, FloorEntry as PlannerFloorEntry } from '@/lib/planner/types'
import { getLegacyPlanFloorDifficulty, isAllowedFloorDifficulty, isFloorDifficulty } from '@/lib/planner/floor-difficulty'

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
  theme_alt_ids?: string[]
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
  name_kr: string
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
  mainKeywords?: string[]
  identities: IdentityData[]
  sinners: SinnerData[]
  egos: EgoData[]
  isOwner: boolean
  isAdmin: boolean
  /** Signed-out visitor whose browser key wrote this plan: writes send the key. */
  guestOwner?: boolean
  /** Set on a guest plan this browser has no key for: shows "edit with password", called once the plan is this browser's. */
  onGuestRecovered?: () => void
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
  mainKeywords = [],
  identities,
  sinners,
  egos,
  isOwner,
  isAdmin,
  guestOwner = false,
  onGuestRecovered,
}: Props) {
  const router = useRouter()
  const t = useTranslations('planner.detail')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [codeCopied, setCodeCopied] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const handleCopyCode = async () => {
    try {
      // the code writer (and its gzip library) loads on the click, not with the page
      const { teamCodeFromPlanSlots } = await import('@/lib/planner/team-code-import')
      // 편성하지 않은 수감자의 인격도 넣는다(빠지면 코드가 그 칸을 LCB 인격으로 채운다)
      const code = teamCodeFromPlanSlots(deck, egoSlots, sinners, identities, egos)
      await navigator.clipboard.writeText(code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      showError(t('copyDeckCodeFailed'))
    }
  }

  const handleFork = () => {
    const planState = {
      difficulty,
      title: t('forkedTitle', { title: planTitle }),
      description: planDescription ?? '',
      identitySlots: deck,
      egoSlots,
      floorPlan,
      giftInventory,
      mainKeywords,
      activeTab: 'deck' as const,
    }
    saveDraftToLocal({
      ...planState,
      identitySlots: planState.identitySlots as PlannerIdentitySlot[],
      egoSlots: planState.egoSlots as PlannerEgoSlot[],
      floorPlan: planState.floorPlan as PlannerFloorEntry[],
    })
    router.push('/planner')
    showSuccess(t('loadedIntoPlanner'))
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
        theme_alt_ids: e?.theme_alt_ids ?? [],
        gift_ids: e?.gift_ids ?? [],
        memo: e?.memo ?? '',
      })),
      giftInventory,
      mainKeywords,
      activeTab: 'deck' as const,
    })
    router.push('/planner/run?from-plan=1')
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
      mainKeywords,
      activeTab: 'deck',
    })
    router.push(`/planner?edit=${planId}`)
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/planner/${planId}`, { method: 'DELETE', headers: guestOwner ? guestHeaders(false) : {} })
      if (res.ok) {
        if (guestOwner) showSuccess(getGuestCopy(locale).deleted)
        router.push('/planner/community')
      } else {
        const data = await res.json().catch(() => null)
        showError(res.status >= 500 ? t('deleteFailed') : data?.error ?? t('deleteFailed'))
      }
    } catch {
      showError(t('deleteError'))
    }
    setShowDeleteModal(false)
  }

  const actionBase = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border px-3.5 text-[0.9375rem] font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 hover:border-[var(--gold-dim)] hover:text-[var(--gold-light)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-2'
  const quietAction = `${actionBase} border-transparent bg-[#ffffff06] text-[#b9a47f]`
  const primaryAction = `${actionBase} border-[var(--gold)] bg-[var(--gold)] text-[var(--bg-deep)] hover:bg-[var(--gold-light)] hover:text-[var(--bg-deep)]`

  return (
    <>
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        <button
          data-plan-action={codeCopied ? 'copied' : 'copy'}
          onClick={handleCopyCode}
          className={codeCopied ? `${actionBase} border-emerald-500/40 bg-emerald-500/10 text-emerald-300` : quietAction}
        >
          {codeCopied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {codeCopied ? t('copied') : t('copyDeckCode')}
        </button>

        <button
          data-plan-action="fork"
          onClick={handleFork}
          className={quietAction}
        >
          <GitFork className="h-4 w-4" aria-hidden="true" />
          {t('fork')}
        </button>

        {<button
          data-plan-action="assist"
          onClick={handleRunMode}
          className={`${primaryAction} min-[420px]:col-span-2`}
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          {t('triggerMode')}
        </button>}

        {(isOwner || isAdmin) && (
          <>
            <button
              data-plan-action="edit"
              onClick={handleEdit}
              className={`${actionBase} border-[#6f5115] bg-[#15100b] text-[var(--gold)]`}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {tCommon('edit')}
            </button>
            <button
              data-plan-action="delete"
              onClick={() => setShowDeleteModal(true)}
              className={`${actionBase} border-red-500/35 bg-[#15100b] text-red-300 hover:border-red-400 hover:text-red-200`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {tCommon('delete')}
            </button>
          </>
        )}
        {onGuestRecovered && <GuestPinRecover kind="plan" id={planId} onRecovered={onGuestRecovered} className={`${actionBase} border-[#6f5115] bg-[#15100b] text-[var(--gold)] min-[420px]:col-span-2`} />}
      </div>

      <ConfirmModal
        open={showDeleteModal}
        title={t('deletePlanTitle')}
        message={t('deletePlanMessage')}
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </>
  )
}

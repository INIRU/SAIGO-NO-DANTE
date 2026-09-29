'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { NoteRenderer, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'
import { NoteGiftClickContext } from '@/components/notes/NoteBlockViewer'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { buildKeywordPool, buildEgoGiftPool } from '@/components/notes/NoteAutocomplete'
import type { PlannerState, PlannerAction, ThemeData, GiftData, SinnerData } from '@/lib/planner/types'

const PlannerGiftModal = dynamic(() => import('@/components/planner/PlannerGiftModal'), { ssr: false })
// Tiptap and ProseMirror load with the editor, not with the planner page. The shell holds its toolbar and 24rem body.
const NoteDocumentEditor = dynamic(() => import('@/components/notes/NoteDocumentEditor'), {
  ssr: false,
  loading: () => <div className="note-editor-shell min-h-[27rem] rounded-md bg-[var(--bg-deep)]" aria-busy="true" />,
})

type Props = {
  state: PlannerState
  dispatch: (action: PlannerAction) => void
  themes: ThemeData[]
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  sinners: SinnerData[]
}

/** Plan title and description, edited in place with the note editor's own preview toggle. */
export default function PlanIntroEditor({ state, dispatch, themes, gifts, giftMap, sinners }: Props) {
  const locale = useLocale()
  const t = useTranslations('planner.intro')
  const [preview, setPreview] = useState(false)
  const [selectedGift, setSelectedGift] = useState<GiftData | null>(null)
  const { keywords } = useKeywordData()
  const allowedKeywords = useMemo(() => new Set(Object.keys(keywords)), [keywords])

  const egoGiftLookup = useMemo(() => {
    const map: Record<string, NoteEgoGiftEntry> = {}
    for (const g of gifts) if (g.name && g.keyword) map[g.name] = { name: g.name, keyword: g.keyword, grade: g.grade ?? '1', image_url: g.image_url, effect_base: g.effect_base }
    return map
  }, [gifts])

  const pool = useMemo(() => [
    ...buildKeywordPool(keywords),
    ...buildEgoGiftPool(Array.from(giftMap.values()).filter(g => g.keyword && g.name).map(g => ({ name: g.name, keyword: g.keyword!, image_url: g.image_url }))),
  ], [keywords, giftMap])

  const formation = useMemo(() => [...state.identitySlots].sort((a, b) => a.slot_order - b.slot_order).map(slot => {
    const sinner = sinners.find(s => s.id === slot.sinner_id)
    const name = (locale === 'en' ? sinner?.name_en : locale === 'ja' ? sinner?.name_jp : sinner?.name_kr) || sinner?.name_kr || slot.sinner_id
    return { identityId: slot.identity_id, sinnerId: slot.sinner_id, name }
  }), [locale, sinners, state.identitySlots])

  const openNoteGift = (key: string) => setSelectedGift(gifts.find(g => g.id === key || g.name === key) ?? null)

  return (
    <div className="plan-intro space-y-3">
      <input
        type="text"
        value={state.title}
        onChange={event => dispatch({ type: 'SET_TITLE', title: event.target.value })}
        maxLength={80}
        placeholder={t('titlePlaceholder')}
        aria-label={t('titleLabel')}
        className="w-full rounded-md border border-[#2e2417] bg-[#17120c] px-4 py-3 font-[family-name:var(--font-heading)] text-lg text-[#e8dcc8] placeholder:text-[#6f604c] focus-visible:border-[#c8900a] focus-visible:outline-none"
      />
      <NoteDocumentEditor
        formation={formation}
        pool={pool}
        value={state.description}
        onChange={description => dispatch({ type: 'SET_DESCRIPTION', description })}
        preview={preview}
        onPreviewChange={setPreview}
        previewContent={<NoteGiftClickContext value={openNoteGift}><NoteRenderer text={state.description} allowedKeywords={allowedKeywords} egoGiftLookup={egoGiftLookup} /></NoteGiftClickContext>}
      />
      {selectedGift && <PlannerGiftModal gift={selectedGift} enhance={0} onClose={() => setSelectedGift(null)} themes={themes} conditionStatus={null} recipe={null} />}
    </div>
  )
}

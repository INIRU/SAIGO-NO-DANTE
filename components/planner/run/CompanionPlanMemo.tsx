'use client'

import { useMemo } from 'react'
import { NoteRenderer, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'
import { noteLabelPreview } from '@/lib/notes/blocks'
import type { GiftData } from '@/lib/planner/types'

/** The plan's memo for a floor, one short paragraph in the companion: gifts as labels, other blocks left out. */
export default function CompanionPlanMemo({ memo, giftMap }: { memo: string | undefined; giftMap: Map<number, GiftData> }) {
  const text = useMemo(() => memo ? noteLabelPreview(memo, id => giftMap.get(Number(id))?.name) : '', [memo, giftMap])
  const lookup = useMemo(() => {
    const byName = new Map([...giftMap.values()].map(gift => [gift.name, gift]))
    const entries: Record<string, NoteEgoGiftEntry> = {}
    for (const [, name] of text.matchAll(/\[g:([^\]]+)\]/g)) {
      const gift = byName.get(name)
      if (gift) entries[name] = { name: gift.name, keyword: gift.keyword ?? '', grade: gift.grade ?? '1', image_url: gift.image_url }
    }
    return entries
  }, [text, giftMap])
  if (!text) return null
  return <p data-plan-memo className="line-clamp-3 border-l-2 border-[var(--gold)] pl-2 text-xs leading-5 text-[var(--text-secondary)]">
    <NoteRenderer text={text} egoGiftLookup={lookup} giftLabel inline />
  </p>
}

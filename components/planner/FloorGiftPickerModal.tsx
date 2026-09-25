'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import GiftCatalog, { giftKeywordIcon, toCatalogGift, useGiftCatalogFilters } from '@/components/gifts/GiftCatalog'
import type { EgoGift } from '@/components/mirror-dungeon/types'
import type { GiftData } from '@/lib/planner/types'

/**
 * Picks gifts for one floor (planner) or the current run (assist): the gift catalog with keyword tabs, grade and search.
 * "Only this floor" (on by default when a theme pack is known) narrows it to that pack's gifts; off shows every gift the
 * floor can still reach (fusions and recipes included), without other packs' exclusives. Choices apply as they are clicked.
 */
export default function FloorGiftPickerModal({ open, title, floorGifts, allGifts, selectedIds, onToggle, onClose }: {
  open: boolean
  title: string
  /** The selected theme pack's gifts; null when no pack is known (the toggle is hidden). */
  floorGifts: GiftData[] | null
  /** Every gift obtainable on this floor, other packs' exclusives already removed. */
  allGifts: GiftData[]
  selectedIds: ReadonlySet<string>
  onToggle: (gift: GiftData) => void
  onClose: () => void
}) {
  const t = useTranslations('floorGiftPicker')
  const [onlyFloor, setOnlyFloor] = useState(true)
  const filters = useGiftCatalogFilters()
  const narrowed = floorGifts !== null && onlyFloor
  const source = narrowed ? floorGifts : allGifts
  const byId = useMemo(() => new Map(allGifts.concat(floorGifts ?? []).map(gift => [String(gift.game_id), gift])), [allGifts, floorGifts])
  const catalog = useMemo(() => source.map(toCatalogGift), [source])

  const toggle = floorGifts !== null && (
    <label className="ml-auto inline-flex min-h-10 cursor-pointer select-none items-center gap-2 text-[0.9375rem] text-[#e8dcc8]">
      <input type="checkbox" checked={onlyFloor} onChange={event => setOnlyFloor(event.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className="grid h-[1.125rem] w-[1.125rem] place-items-center rounded-[0.25rem] border border-[#5a4526] bg-[#0d0b08] text-transparent transition-colors peer-checked:border-[#c8900a] peer-checked:bg-[#c8900a] peer-checked:text-[#0d0b08] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#e8b030]">
        <Check size={13} strokeWidth={3} />
      </span>
      {t('onlyFloor')}
    </label>
  )

  return (
    <BaseModal open={open} onClose={onClose} title={title} maxWidth="64rem">
      <div className="flex h-[min(80dvh,56rem)] flex-col rounded-xl border border-[rgba(200,144,10,0.22)] bg-[#17120c] shadow-[0_1.5rem_3rem_rgba(0,0,0,0.55)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#2e2417] px-5 py-3">
          <h2 className="font-[family-name:var(--font-heading)] text-[1.125rem] text-[#e8dcc8]">
            {title}
            {selectedIds.size > 0 && <span className="ml-2 font-[family-name:var(--font-title)] text-[1.125rem] text-[#e8b030]">{selectedIds.size}</span>}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('close')}
            className="grid h-10 w-10 place-items-center rounded text-[#9c8b73] transition-colors hover:bg-white/5 hover:text-[#e8dcc8]">
            <X size={18} />
          </button>
        </div>
        {/* 위쪽 여백은 안쪽에: 기프트 목록의 고정 도구줄이 스크롤 상자 맨 위에 붙는다 */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          <div className="pt-4" style={{ '--gift-catalog-bg': 'var(--bg-card)', '--gift-catalog-sticky-top': '0px', '--gift-catalog-min-h': '0px' } as React.CSSProperties}>
            <GiftCatalog compact gifts={catalog} getGiftKeywordIcon={giftKeywordIcon} filters={filters} selectedIds={selectedIds}
              toolbarEnd={toggle || undefined}
              onGiftClick={(gift: EgoGift) => { const data = byId.get(gift.id); if (data) onToggle(data) }} />
            {catalog.length === 0 && <p className="py-10 text-center text-[0.9375rem] text-[#9c8b73]">{t('empty')}</p>}
          </div>
        </div>
      </div>
    </BaseModal>
  )
}

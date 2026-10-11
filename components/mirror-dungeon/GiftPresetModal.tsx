'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import GiftCatalog, { useGiftCatalogFilters } from '@/components/gifts/GiftCatalog'
import type { EgoGift } from '@/components/mirror-dungeon/types'
import { GIFT_PRESET_NAME_MAX, giftCheckKey, toggleChecked, type GiftPreset } from '@/lib/mirror-dungeon/gift-check'

interface GiftPresetModalProps {
  open: boolean
  preset: GiftPreset
  gifts: EgoGift[]
  keywordOrder: readonly string[]
  getGiftKeywordIcon: (keyword: string) => string | null
  onChange: (preset: GiftPreset) => void
  onDelete: () => void
  onClose: () => void
}

/** Names a preset and picks its gifts, laid out like the planner's gift picker. Changes apply as they are made. */
export default function GiftPresetModal({ open, preset, gifts, keywordOrder, getGiftKeywordIcon, onChange, onDelete, onClose }: GiftPresetModalProps) {
  const t = useTranslations('mirrorDungeonPage')
  const filters = useGiftCatalogFilters()
  const selectedIds = useMemo(() => {
    const keys = new Set(preset.gifts)
    return new Set(gifts.filter(gift => keys.has(giftCheckKey(gift))).map(gift => gift.id))
  }, [preset.gifts, gifts])

  return (
    <BaseModal open={open} onClose={onClose} title={t('presetEdit')} maxWidth="64rem">
      <div className="flex h-[min(80dvh,56rem)] flex-col rounded-xl border border-[rgba(200,144,10,0.22)] bg-[#17120c] shadow-[0_1.5rem_3rem_rgba(0,0,0,0.55)]">
        <div className="flex shrink-0 items-center gap-2 border-b border-[#2e2417] py-2 pl-5 pr-2">
          <input type="text" value={preset.name} maxLength={GIFT_PRESET_NAME_MAX} aria-label={t('presetName')} placeholder={t('presetName')}
            onChange={event => onChange({ ...preset, name: event.target.value })}
            className="h-10 min-w-0 flex-1 rounded border border-[#2e2417] bg-[#0d0b08] px-3 font-[family-name:var(--font-heading)] text-[1.0625rem] text-[#e8dcc8] outline-none placeholder:text-[#6a6058] focus-visible:border-[var(--gold)] sm:max-w-[18rem]" />
          <span className="tabular-nums font-[family-name:var(--font-title)] text-[1.125rem] text-[#e8b030]">{selectedIds.size}</span>
          <button type="button" onClick={onDelete}
            className="ml-auto flex h-10 shrink-0 items-center gap-1.5 rounded px-2.5 text-[0.8125rem] text-[#9c8b73] transition-colors hover:bg-white/5 hover:text-[#ff9c9c]">
            <Trash2 size={15} aria-hidden />{t('presetDelete')}
          </button>
          <button type="button" onClick={onClose} aria-label={t('close')}
            className="grid h-10 w-10 shrink-0 place-items-center rounded text-[#9c8b73] transition-colors hover:bg-white/5 hover:text-[#e8dcc8]">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          <div className="pt-4" style={{ '--gift-catalog-bg': 'var(--bg-card)', '--gift-catalog-sticky-top': '-1px', '--gift-catalog-min-h': '0px' } as React.CSSProperties}>
            <GiftCatalog compact gifts={gifts} getGiftKeywordIcon={getGiftKeywordIcon} filters={filters} selectedIds={selectedIds} keywordOrder={keywordOrder}
              onGiftClick={gift => onChange({ ...preset, gifts: toggleChecked(preset.gifts, giftCheckKey(gift)) })} />
          </div>
        </div>
      </div>
    </BaseModal>
  )
}

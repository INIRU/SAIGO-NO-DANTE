'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { Bookmark, ListChecks, PictureInPicture2, RotateCcw, Settings, X } from 'lucide-react'
import GiftCatalog, { FilterChip, type GiftCatalogCardProps, type GiftCatalogFilters } from '@/features/mirror-dungeon/components/GiftCatalog'
import GiftPresetModal from '@/features/mirror-dungeon/components/GiftPresetModal'
import GiftCheckWindow from '@/features/mirror-dungeon/components/GiftCheckWindow'
import { GiftWarningMark } from '@/features/mirror-dungeon/components/GiftCard'
import QuietImage from '@/components/ui/QuietImage'
import ConfirmModal from '@/components/ui/ConfirmModal'
import KeywordOrderModal from '@/features/mirror-dungeon/components/KeywordOrderModal'
import type { EgoGift, EgoGiftTheme, Recipe } from '@/features/mirror-dungeon/types'
import { getThemePackCompositeImageUrl, getThemePackVisualConfig } from '@/lib/data/theme-pack-visuals'
import { getLocalizedName } from '@/lib/i18n/localize'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import {
  GIFT_CHECK_STORAGE, GIFT_KEYWORD_ORDER_STORAGE, fusionIngredientNames, giftCheckKey, giftCheckMarks, normalizeChecked, normalizeKeywordOrder, toggleChecked,
} from '@/features/mirror-dungeon/lib/gift-check'
import { createPreset, presetSections } from '@/features/mirror-dungeon/lib/gift-presets'
import { useGiftPresets } from '@/features/mirror-dungeon/hooks/useGiftPresets'
import { useStored } from '@/hooks/useStored'
import { useCompanionWindow } from '@/features/assist/hooks/useCompanionWindow'
import { showError, showSuccess } from '@/lib/toast'

interface GiftTabProps extends GiftCatalogFilters {
  gifts: EgoGift[]
  themes: EgoGiftTheme[]
  recipes: Recipe[]
  getGiftKeywordIcon: (keyword: string) => string | null
  onSelectGift: (gift: EgoGift) => void
  checkMode: boolean
  onCheckModeChange: (on: boolean) => void
}

const localized = (item: { name: string; name_en?: string | null; name_jp?: string | null }, lang: SupportedLang) =>
  getLocalizedName({ name_kr: item.name, name_en: item.name_en, name_jp: item.name_jp }, lang)

/** The pack a gift is only found in, drawn small over the gift's top-right corner; "+n" when more packs give it. */
function PackMark({ packs, label }: { packs: EgoGiftTheme[]; label: string }) {
  const [first] = packs
  const src = getThemePackVisualConfig(first.id) ? getThemePackCompositeImageUrl(first.id) : first.image_url
  return (
    <span role="img" aria-label={label} className="pointer-events-none absolute -top-0.5 right-0 z-30 flex w-[30%] flex-col items-center">
      {src && (
        <span className="relative block w-full drop-shadow-[0_0.0625rem_0.1875rem_rgba(0,0,0,0.85)]" style={{ aspectRatio: '416/684' }}>
          <QuietImage src={src} alt="" fill sizes="32px" className="object-cover" />
        </span>
      )}
      {packs.length > 1 && (
        <span className="mt-px rounded-[0.125rem] bg-[var(--bg-deep)]/85 px-0.5 tabular-nums text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-title)', fontSize: '0.6875rem', lineHeight: 1 }}>+{packs.length - 1}</span>
      )}
    </span>
  )
}

const TOOL = 'flex h-9 max-sm:h-11 shrink-0 items-center justify-center gap-1.5 rounded border border-[#2e2417] text-[0.8125rem] text-[#9c8b73] transition-colors hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-deep)]'

/** Mirror Dungeon gift list. A click opens the gift detail; in check mode it records the gift as obtained. */
export default function GiftTab({ gifts, themes, recipes, getGiftKeywordIcon, onSelectGift, checkMode, onCheckModeChange, ...filters }: GiftTabProps) {
  const t = useTranslations('mirrorDungeonPage')
  const lang = useLocale() as SupportedLang
  const [order, saveOrder] = useStored(GIFT_KEYWORD_ORDER_STORAGE, normalizeKeywordOrder)
  const [checked, saveChecked] = useStored(GIFT_CHECK_STORAGE, normalizeChecked)
  const [presets, savePresets] = useGiftPresets({ loadFailed: t('presetLoadFailed'), saveFailed: t('presetSaveFailed') })
  const [orderOpen, setOrderOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  // null until the editor is first opened: it is not mounted before that.
  const [presetOpen, setPresetOpen] = useState<boolean | null>(null)

  const checkedIds = useMemo(() => {
    const keys = new Set(checked)
    return new Set(gifts.filter(gift => keys.has(giftCheckKey(gift))).map(gift => gift.id))
  }, [checked, gifts])

  // With a preset chosen, check mode lists that preset's gifts alone: group by group, each in the order its gifts were
  // placed, the memo under the group's name. A preset without gifts filters nothing.
  const preset = presets.list.find(item => item.id === presets.active) ?? null
  const view = useMemo(() => {
    if (!checkMode || !preset) return null
    const sections = presetSections(preset, gifts)
      .map((section, index) => ({ ...section, label: section.name.trim() || t('presetGroupNumbered', { number: index + 1 }) }))
      .filter(section => section.gifts.length > 0)
    if (!sections.length) return null
    const shown = sections.map(section => ({ label: section.label, note: section.memo.trim() || undefined, gifts: section.gifts }))
    return {
      gifts: shown.flatMap(section => section.gifts),
      sections: shown,
      pinned: shown.map(section => ({ ids: new Set(section.gifts.map(gift => gift.id)), label: section.label, note: section.note })),
    }
  }, [checkMode, preset, gifts, t])
  // The chosen preset in a window that stays above the game (the assist companion's window). It closes when check mode
  // ends or no preset is chosen. it shares the companion's stored size; give it its own key if they diverge.
  const { container: pip, open: openPip, close: closePip } = useCompanionWindow()
  const [pipSupported, setPipSupported] = useState(true)
  useEffect(() => { setPipSupported('documentPictureInPicture' in window) }, [])
  const hasView = view !== null
  useEffect(() => { if (!hasView) closePip() }, [hasView]) // eslint-disable-line react-hooks/exhaustive-deps
  // The editor always has a preset to show: the first press makes one, without choosing it for check mode.
  const openPresets = () => {
    const made = presets.list.length ? null : createPreset(presets, t('presetNumbered', { number: 1 }))
    if (made) savePresets({ ...made, active: presets.active })
    setPresetOpen(true)
  }

  // Built once per gift list: each cell keeps the same badge element and card props, so a check redraws one cell.
  const marks = useMemo(() => {
    const out = new Map<string, { badge: ReactNode; card: GiftCatalogCardProps }>()
    if (!checkMode) return out
    const fusion = translations['mirrorDungeon.gift.synthesis'][lang]
    const byId = giftCheckMarks(gifts, themes)
    for (const gift of gifts) {
      const mark = byId.get(gift.id)
      if (!mark) continue
      const label = mark.fusion ? fusion : t('packOnly', { packs: mark.packs.map(pack => localized(pack, lang)).join(', ') })
      out.set(gift.id, {
        badge: mark.fusion ? <GiftWarningMark label={label} tone="yellow" /> : <PackMark packs={mark.packs} label={label} />,
        card: { title: `${localized(gift, lang)} · ${label}` },
      })
    }
    return out
  }, [checkMode, gifts, themes, lang, t])

  // A fusion gift takes its ingredients with it: they are spent to make it.
  const check = (gift: EgoGift) => {
    const parts = gift.is_synthesis ? fusionIngredientNames(gift.name, recipes) : []
    saveChecked(toggleChecked(checked, giftCheckKey(gift), gifts.filter(other => parts.includes(other.name)).map(giftCheckKey)))
  }

  const presetButton = (
    <button type="button" title={t('preset')} onClick={openPresets} className={`${TOOL} min-w-9 px-2.5`} style={{ fontFamily: 'var(--font-heading)' }}>
      <Bookmark size={15} aria-hidden /><span className={checkMode ? 'sr-only' : 'max-sm:sr-only'}>{t('preset')}</span>
    </button>
  )
  const tools = checkMode ? (
    <>
      <div className="flex items-center gap-1.5">
        {presets.list.length > 0 && (
          <FilterChip label={t('preset')} clearLabel={t('presetClear')} value={preset?.id ?? null} onChange={id => savePresets({ ...presets, active: id })} minWidth={160}
            options={presets.list.map(item => ({ value: item.id, label: item.name.trim() || t('preset') }))} />
        )}
        {presetButton}
        {view && (
          <button type="button" aria-pressed={!!pip} aria-label={t('checkPip')} title={t(pipSupported ? 'checkPip' : 'checkPipUnsupported')} disabled={!pipSupported}
            onClick={() => { if (pip) closePip(); else void openPip().catch(() => showError(t('checkPipFailed'))) }}
            className={`${TOOL} w-9 max-sm:hidden ${pip ? 'border-[var(--gold)]! text-[var(--gold-light)]!' : ''}`}>
            <PictureInPicture2 size={15} aria-hidden />
          </button>
        )}
      </div>
      <p className="text-[0.8125rem] text-[#9c8b73]">
        {t('checked')} <span className="tabular-nums text-[var(--gold-light)]" style={{ fontFamily: 'var(--font-title)', fontSize: '1.125rem', lineHeight: 1 }}>
          {view ? `${view.gifts.filter(gift => checkedIds.has(gift.id)).length} / ${view.gifts.length}` : checkedIds.size}
        </span>
      </p>
      <div className="flex items-center gap-1.5">
        <button type="button" disabled={checked.length === 0} onClick={() => setResetOpen(true)} className={`${TOOL} px-2.5`} style={{ fontFamily: 'var(--font-heading)' }}>
          <RotateCcw size={14} aria-hidden />{t('checkReset')}
        </button>
        <button type="button" aria-label={t('checkExit')} title={t('checkExit')} onClick={() => onCheckModeChange(false)} className={`${TOOL} w-9`}>
          <X size={16} aria-hidden />
        </button>
      </div>
    </>
  ) : (
    <div className="flex items-center gap-1.5">
      {presetButton}
      <button type="button" onClick={() => onCheckModeChange(true)} className={`${TOOL} min-w-9 px-2.5`} style={{ fontFamily: 'var(--font-heading)' }}>
        <ListChecks size={15} aria-hidden /><span className="max-sm:sr-only">{t('checkMode')}</span>
      </button>
    </div>
  )

  return (
    <>
      <GiftCatalog
        gifts={view?.gifts ?? gifts}
        keepOrder={view !== null}
        pinned={view?.pinned}
        themes={themes}
        getGiftKeywordIcon={getGiftKeywordIcon}
        filters={filters}
        keywordOrder={order}
        keywordsEnd={
          <button type="button" aria-label={t('keywordOrder')} title={t('keywordOrder')} onClick={() => setOrderOpen(true)}
            className="grid h-9 w-9 max-sm:h-11 max-sm:w-11 place-items-center rounded text-[#9c8b73] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--gold-light)]">
            <Settings size={16} aria-hidden />
          </button>
        }
        toolbarEnd={tools}
        onGiftClick={checkMode ? check : onSelectGift}
        markedIds={checkMode ? checkedIds : undefined}
        markedLabel={t('checked')}
        cardProps={checkMode ? gift => checkedIds.has(gift.id) ? undefined : marks.get(gift.id)?.card : undefined}
        renderBadge={checkMode ? gift => checkedIds.has(gift.id) ? undefined : marks.get(gift.id)?.badge : undefined}
      />
      <KeywordOrderModal open={orderOpen} order={order} onChange={saveOrder} onClose={() => setOrderOpen(false)} getGiftKeywordIcon={getGiftKeywordIcon} />
      {presetOpen !== null && (
        <GiftPresetModal open={presetOpen} presets={presets} gifts={gifts} keywordOrder={order} getGiftKeywordIcon={getGiftKeywordIcon}
          onChange={savePresets} onClose={() => setPresetOpen(false)} />
      )}
      {pip && view && createPortal(
        <GiftCheckWindow title={preset?.name.trim() || t('preset')} sections={view.sections} checkedIds={checkedIds} checkedLabel={t('checked')} onCheck={check} marks={marks} />,
        pip,
      )}
      <ConfirmModal open={resetOpen} message={t('checkResetConfirm')} confirmLabel={t('checkReset')} variant="danger"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => { saveChecked([]); setResetOpen(false); showSuccess(t('checkResetDone')) }} />
    </>
  )
}

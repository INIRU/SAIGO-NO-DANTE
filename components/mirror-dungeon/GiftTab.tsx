'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ListChecks, Pencil, RotateCcw, Settings, X } from 'lucide-react'
import GiftCatalog, { FilterChip, type GiftCatalogCardProps, type GiftCatalogFilters } from '@/components/gifts/GiftCatalog'
import GiftPresetModal from '@/components/mirror-dungeon/GiftPresetModal'
import { GiftWarningMark } from '@/components/ui/GiftCard'
import QuietImage from '@/components/ui/QuietImage'
import ConfirmModal from '@/components/ui/ConfirmModal'
import KeywordOrderModal from '@/components/mirror-dungeon/KeywordOrderModal'
import type { EgoGift, EgoGiftTheme, Recipe } from '@/components/mirror-dungeon/types'
import { getThemePackCompositeImageUrl, getThemePackVisualConfig } from '@/lib/data/theme-pack-visuals'
import { getLocalizedName } from '@/lib/i18n/localize'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import {
  GIFT_CHECK_STORAGE, GIFT_KEYWORD_ORDER_STORAGE, GIFT_PRESET_LIMIT, GIFT_PRESET_STORAGE, fusionIngredientNames, giftCheckKey, giftCheckMarks,
  normalizeChecked, normalizeKeywordOrder, normalizePresets, presetGifts, toggleChecked, type GiftPreset,
} from '@/lib/mirror-dungeon/gift-check'
import { showSuccess } from '@/lib/toast'

interface GiftTabProps extends GiftCatalogFilters {
  gifts: EgoGift[]
  themes: EgoGiftTheme[]
  recipes: Recipe[]
  getGiftKeywordIcon: (keyword: string) => string | null
  onSelectGift: (gift: EgoGift) => void
  checkMode: boolean
  onCheckModeChange: (on: boolean) => void
}

/** A JSON value kept in localStorage. It is read after mount, so the prerendered list hydrates unchanged. */
function useStored<T>(key: string, parse: (saved: unknown) => T): [T, (next: T) => void] {
  const [value, setValue] = useState(() => parse(null))
  useEffect(() => {
    try { setValue(parse(JSON.parse(localStorage.getItem(key) ?? 'null'))) } catch { /* unreadable: keep the default */ }
  }, [key, parse])
  const save = useCallback((next: T) => {
    setValue(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* private mode: kept for this page only */ }
  }, [key])
  return [value, save]
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
        <span className="mt-px rounded-[0.125rem] bg-[#0d0b08]/85 px-0.5 tabular-nums text-[#e8dcc8]" style={{ fontFamily: 'var(--font-title)', fontSize: '0.6875rem', lineHeight: 1 }}>+{packs.length - 1}</span>
      )}
    </span>
  )
}

const NEW_PRESET = '__new'
const TOOL ='flex h-9 shrink-0 items-center justify-center gap-1.5 rounded border border-[#2e2417] text-[0.8125rem] text-[#9c8b73] transition-colors hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0d0b08]'

/** Mirror Dungeon gift list. A click opens the gift detail; in check mode it records the gift as obtained. */
export default function GiftTab({ gifts, themes, recipes, getGiftKeywordIcon, onSelectGift, checkMode, onCheckModeChange, ...filters }: GiftTabProps) {
  const t = useTranslations('mirrorDungeonPage')
  const lang = useLocale() as SupportedLang
  const [order, saveOrder] = useStored(GIFT_KEYWORD_ORDER_STORAGE, normalizeKeywordOrder)
  const [checked, saveChecked] = useStored(GIFT_CHECK_STORAGE, normalizeChecked)
  const [presets, savePresets] = useStored(GIFT_PRESET_STORAGE, normalizePresets)
  const [orderOpen, setOrderOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [presetOpen, setPresetOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const checkedIds = useMemo(() => {
    const keys = new Set(checked)
    return new Set(gifts.filter(gift => keys.has(giftCheckKey(gift))).map(gift => gift.id))
  }, [checked, gifts])

  // With a preset chosen, check mode lists that preset's gifts alone: by keyword, each keyword in the order they were added.
  const preset = presets.list.find(item => item.id === presets.active) ?? null
  const presetList = useMemo(() => checkMode && preset ? presetGifts(preset, gifts) : null, [checkMode, preset, gifts])
  const presetName = preset ? preset.name.trim() || t('preset') : ''
  const savePreset = (next: GiftPreset) => savePresets({ ...presets, list: presets.list.map(item => item.id === next.id ? next : item) })
  const choosePreset = (id: string | null) => {
    if (id !== NEW_PRESET) return savePresets({ ...presets, active: id })
    const created = { id: Date.now().toString(36), name: t('presetNumbered', { number: presets.list.length + 1 }), gifts: [] }
    savePresets({ active: created.id, list: [...presets.list, created] })
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

  const tools = checkMode ? (
    <>
      <div className="flex items-center gap-1.5">
        <FilterChip label={t('preset')} clearLabel={t('presetClear')} value={preset?.id ?? null} onChange={choosePreset} minWidth={160}
          options={[...presets.list.map(item => ({ value: item.id, label: item.name.trim() || t('preset') })), ...(presets.list.length < GIFT_PRESET_LIMIT ? [{ value: NEW_PRESET, label: t('presetNew') }] : [])]} />
        {preset && (
          <button type="button" aria-label={t('presetEdit')} title={t('presetEdit')} onClick={() => setPresetOpen(true)} className={`${TOOL} w-9`}>
            <Pencil size={14} aria-hidden />
          </button>
        )}
      </div>
      <p className="text-[0.8125rem] text-[#9c8b73]">
        {t('checked')} <span className="tabular-nums text-[var(--gold-light)]" style={{ fontFamily: 'var(--font-title)', fontSize: '1.125rem', lineHeight: 1 }}>
          {presetList ? `${presetList.filter(gift => checkedIds.has(gift.id)).length} / ${presetList.length}` : checkedIds.size}
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
    <button type="button" onClick={() => onCheckModeChange(true)} className={`${TOOL} min-w-9 px-2.5`} style={{ fontFamily: 'var(--font-heading)' }}>
      <ListChecks size={15} aria-hidden /><span className="max-sm:sr-only">{t('checkMode')}</span>
    </button>
  )

  return (
    <>
      <GiftCatalog
        gifts={presetList ?? gifts}
        keepOrder={presetList !== null}
        themes={themes}
        getGiftKeywordIcon={getGiftKeywordIcon}
        filters={filters}
        keywordOrder={order}
        keywordsEnd={
          <button type="button" aria-label={t('keywordOrder')} title={t('keywordOrder')} onClick={() => setOrderOpen(true)}
            className="grid h-9 w-9 place-items-center rounded text-[#9c8b73] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--gold-light)]">
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
      {preset && (
        <GiftPresetModal open={presetOpen} preset={preset} gifts={gifts} keywordOrder={order} getGiftKeywordIcon={getGiftKeywordIcon}
          onChange={savePreset} onDelete={() => setDeleteOpen(true)} onClose={() => setPresetOpen(false)} />
      )}
      <ConfirmModal open={deleteOpen} message={t('presetDeleteConfirm', { name: presetName })} confirmLabel={t('presetDelete')} variant="danger"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          savePresets({ active: null, list: presets.list.filter(item => item.id !== presets.active) })
          setDeleteOpen(false)
          setPresetOpen(false)
          showSuccess(t('presetDeleted'))
        }} />
      <ConfirmModal open={resetOpen} message={t('checkResetConfirm')} confirmLabel={t('checkReset')} variant="danger"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => { saveChecked([]); setResetOpen(false); showSuccess(t('checkResetDone')) }} />
    </>
  )
}

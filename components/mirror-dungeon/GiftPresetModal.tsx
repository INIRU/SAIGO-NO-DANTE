'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { ClipboardPaste, Copy, Plus, Trash2, X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Dropdown from '@/components/ui/Dropdown'
import GiftArtwork from '@/components/ui/GiftArtwork'
import GiftCard from '@/components/ui/GiftCard'
import GiftCatalog, { useGiftCatalogFilters } from '@/components/gifts/GiftCatalog'
import type { EgoGift } from '@/components/mirror-dungeon/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { giftCheckKey } from '@/lib/mirror-dungeon/gift-check'
import {
  GIFT_PRESET_GIFT_LIMIT, GIFT_PRESET_GROUP_LIMIT, GIFT_PRESET_LIMIT, GIFT_PRESET_MEMO_MAX, GIFT_PRESET_NAME_MAX,
  addGroup, createPreset, deletePreset, placeGift, presetGiftCount, removeGift, removeGroup, toggleGift,
  type GiftPreset, type GiftPresetBody, type GiftPresetGroup, type GiftPresets,
} from '@/lib/mirror-dungeon/gift-presets'
import { showError, showSuccess } from '@/lib/toast'

/** The gift being dragged; `from` is the group it was taken from, null for one taken from the gift list. */
export interface HeldGift { key: string; from: number | null }
/** Where a dragged gift would land: in `group`, before the gift `before` or at the end. */
export interface DropSpot { group: number; before: string | null }

const DRAG_START = 6
const ICON = 'grid h-11 w-11 shrink-0 place-items-center rounded text-[#9c8b73] transition-colors hover:bg-white/5 hover:text-[#e8dcc8] motion-reduce:transition-none'
const FIELD = 'min-w-0 rounded border border-[#2e2417] bg-[#0d0b08] px-3 text-[#e8dcc8] placeholder:text-[#6a6058] focus-visible:border-[var(--gold)]'
const NUMBER: CSSProperties = { fontFamily: 'var(--font-title)', fontSize: '1.25rem', lineHeight: 1 }

/**
 * Drags a gift by pointer events. The modal's root listens once: a press on anything with `data-gift-id` (a catalog cell
 * or a gift in a group) becomes a drag after a few pixels, so the catalog's memoized cells need no handler of their own.
 * While held, only the ghost's transform changes; React state changes when the landing spot does.
 * Touch is left to scrolling: there a gift is added by choosing a group and pressing the gift.
 */
function useGiftDrag(active: boolean, keyOf: (giftId: string) => string | undefined, onDrop: (held: HeldGift, spot: DropSpot) => void) {
  const [held, setHeld] = useState<HeldGift | null>(null)
  const [over, setOver] = useState<DropSpot | null>(null)
  const press = useRef<(HeldGift & { x: number; y: number; moved: boolean }) | null>(null)
  const ghost = useRef<HTMLDivElement | null>(null)
  const spot = useRef<DropSpot | null>(null)
  const swallowClick = useRef(false)
  // Closed while a gift is held (Escape): the release never arrives, so the drag ends here.
  useEffect(() => {
    if (active) return
    press.current = null
    spot.current = null
    setHeld(null)
    setOver(null)
  }, [active])

  const moveGhost = (x: number, y: number) => {
    // Hung just off the pointer, so the mark of the landing spot under it stays in view.
    if (ghost.current) ghost.current.style.transform = `translate3d(${x + 6}px, ${y + 6}px, 0)`
  }
  const ghostRef = useCallback((node: HTMLDivElement | null) => {
    ghost.current = node
    if (press.current) moveGhost(press.current.x, press.current.y)
  }, [])
  const spotAt = (x: number, y: number): DropSpot | null => {
    const group = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-preset-group]')
    const list = group?.querySelector('ul')?.getBoundingClientRect()
    if (!group || !list) return null
    // Inside the gift rows: before the first gift that is further along the pointer's row, or on a row below it.
    const next = y < list.top || y > list.bottom ? undefined : [...group.querySelectorAll<HTMLElement>('[data-preset-chip]')].find(chip => {
      const rect = chip.getBoundingClientRect()
      return y < rect.top || (y <= rect.bottom && x < rect.left + rect.width / 2)
    })
    return { group: Number(group.dataset.presetGroup), before: next?.dataset.presetChip ?? null }
  }
  const end = (event: PointerEvent, drop: boolean) => {
    const start = press.current
    press.current = null
    if (!start?.moved) return
    // The click that follows this release belongs to the drag, not to the gift under the pointer.
    swallowClick.current = true
    setTimeout(() => { swallowClick.current = false }, 0)
    const landed = drop ? spotAt(event.clientX, event.clientY) : null
    spot.current = null
    setHeld(null)
    setOver(null)
    if (landed) onDrop({ key: start.key, from: start.from }, landed)
  }

  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || event.pointerType === 'touch') return
      const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-gift-id]')
      const key = cell?.dataset.giftId ? keyOf(cell.dataset.giftId) : undefined
      if (!cell || !key) return
      const from = cell.closest<HTMLElement>('[data-preset-group]')?.dataset.presetGroup
      press.current = { key, from: from === undefined ? null : Number(from), x: event.clientX, y: event.clientY, moved: false }
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const start = press.current
      if (!start) return
      if (!(event.buttons & 1)) { end(event, false); return }
      if (!start.moved) {
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < DRAG_START) return
        start.moved = true
        event.currentTarget.setPointerCapture(event.pointerId)
        window.getSelection()?.removeAllRanges()
        setHeld({ key: start.key, from: start.from })
      }
      start.x = event.clientX
      start.y = event.clientY
      moveGhost(start.x, start.y)
      const next = spotAt(start.x, start.y)
      if (next?.group !== spot.current?.group || next?.before !== spot.current?.before) { spot.current = next; setOver(next) }
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => end(event, true),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => end(event, false),
    onClickCapture: (event: MouseEvent) => {
      if (!swallowClick.current) return
      swallowClick.current = false
      event.preventDefault()
      event.stopPropagation()
    },
    // The browser's own image drag would cancel the pointer.
    onDragStart: (event: { preventDefault: () => void }) => event.preventDefault(),
  }
  return { held, over, ghostRef, handlers }
}

/**
 * A preset's name and its groups. Each group has a name, its gifts (a press takes one out; arrow keys move it inside the
 * group) and a memo. The chosen group, the one a pressed catalog gift goes into, carries the filled number. Below the
 * two-column width (lg) only the chosen group is shown, picked with the number tabs.
 */
export function GiftPresetPanel({ preset, gifts, selected, onSelect, onChange, onRemoveGroup, held, over, actions }: {
  preset: GiftPreset
  gifts: EgoGift[]
  selected: number
  onSelect: (group: number) => void
  onChange: (preset: GiftPreset) => void
  onRemoveGroup: (group: number) => void
  held: HeldGift | null
  over: DropSpot | null
  /** Buttons at the end of the name row (copy, import, delete). */
  actions: ReactNode
}) {
  const t = useTranslations('mirrorDungeonPage')
  const lang = useLocale() as SupportedLang
  const root = useRef<HTMLDivElement>(null)
  const refocus = useRef<string | null>(null)
  const byKey = useMemo(() => new Map(gifts.map(gift => [giftCheckKey(gift), gift])), [gifts])
  const label = (index: number) => preset.groups[index].name.trim() || t('presetGroupNumbered', { number: index + 1 })
  const editGroup = (index: number, patch: Partial<GiftPresetGroup>) =>
    onChange({ ...preset, groups: preset.groups.map((group, i) => i === index ? { ...group, ...patch } : group) })
  const canAdd = preset.groups.length < GIFT_PRESET_GROUP_LIMIT
  const add = () => { onChange(addGroup(preset)); onSelect(preset.groups.length) }
  const step = (index: number, key: string, event: KeyboardEvent) => {
    const list = preset.groups[index].gifts
    const at = list.indexOf(key)
    const to = at + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0)
    if (to === at || to < 0 || to >= list.length) return
    event.preventDefault()
    refocus.current = key
    onChange(placeGift(preset, key, index, to < at ? list[to] : list[to + 1] ?? null))
  }
  // A moved element loses focus when the browser re-inserts it: give it back to the gift that was moved.
  useEffect(() => {
    if (!refocus.current) return
    root.current?.querySelector<HTMLElement>(`[data-preset-chip="${CSS.escape(refocus.current)}"] button`)?.focus()
    refocus.current = null
  })
  const tab = (chosen: boolean) => chosen ? 'bg-[var(--gold)] text-[#0d0b08]' : 'bg-[#241c12] text-[#9c8b73] hover:text-[#e8dcc8]'

  return (
    <div ref={root} className="flex flex-col gap-2.5 p-4 lg:px-5 lg:pt-[0.875rem]">
      <div className="flex items-center gap-1 lg:-mb-1">
        <input type="text" maxLength={GIFT_PRESET_NAME_MAX} aria-label={t('presetName')} placeholder={t('presetName')} value={preset.name}
          onChange={event => onChange({ ...preset, name: event.target.value })}
          className={`${FIELD} h-11 flex-1 font-[family-name:var(--font-heading)] text-[1.0625rem]`} />
        <p className="shrink-0 px-1.5 tabular-nums" style={NUMBER}>
          <span className="text-[#e8b030]">{presetGiftCount(preset)}</span><span className="text-[#6a6058]">/{GIFT_PRESET_GIFT_LIMIT}</span>
        </p>
        {actions}
      </div>

      <div className="flex items-center gap-1 lg:hidden">
        {preset.groups.map((_, index) => (
          <button key={index} type="button" aria-pressed={index === selected} aria-label={t('presetGroupSelect', { name: label(index) })} onClick={() => onSelect(index)}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded tabular-nums transition-colors motion-reduce:transition-none ${tab(index === selected)}`} style={NUMBER}>
            {index + 1}
          </button>
        ))}
        <button type="button" disabled={!canAdd} aria-label={t('presetGroupAdd')} title={t('presetGroupAdd')} onClick={add} className={`${ICON} ml-auto disabled:pointer-events-none disabled:opacity-40`}>
          <Plus size={18} aria-hidden />
        </button>
      </div>

      {preset.groups.map((group, index) => {
        const chosen = index === selected
        const target = over?.group === index
        return (
          <section key={index} data-preset-group={index} aria-label={label(index)} onPointerDown={() => onSelect(index)}
            className={`${chosen ? '' : 'max-lg:hidden '}rounded-lg border p-2.5 transition-colors motion-reduce:transition-none ${target ? 'border-[#e8b030] bg-[#241c12]' : chosen ? 'border-[rgba(200,144,10,0.5)] bg-[#1d160d]' : 'border-[#2e2417] bg-[#120e09]'}`}>
            <div className="flex items-center gap-1.5">
              <button type="button" aria-pressed={chosen} aria-label={t('presetGroupSelect', { name: label(index) })} onClick={() => onSelect(index)}
                className={`hidden h-9 w-9 shrink-0 place-items-center rounded tabular-nums transition-colors motion-reduce:transition-none lg:grid ${tab(chosen)}`} style={NUMBER}>
                {index + 1}
              </button>
              <input type="text" maxLength={GIFT_PRESET_NAME_MAX} aria-label={t('presetGroupName')} placeholder={t('presetGroupNumbered', { number: index + 1 })} value={group.name}
                onChange={event => editGroup(index, { name: event.target.value })}
                className={`${FIELD} h-11 flex-1 font-[family-name:var(--font-heading)] text-[0.9375rem] lg:h-9 lg:min-h-0!`} />
              <span className="w-7 shrink-0 text-center tabular-nums text-[#9c8b73]" style={NUMBER}>{group.gifts.length}</span>
              <button type="button" aria-label={t('presetGroupDelete', { name: label(index) })} title={t('presetGroupDelete', { name: label(index) })}
                onClick={() => onRemoveGroup(index)} className={`${ICON} hover:text-[#ff9c9c] lg:h-9 lg:w-9 lg:min-h-0! lg:min-w-0!`}>
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
            <ul className="mt-2 flex min-h-[3.25rem] flex-wrap content-start gap-1 rounded border border-[#241c14] bg-[#0d0b08] p-1 lg:min-h-[calc(3.75rem+2px)] [&_.gift-card:hover]:[transform:none]!">
              {group.gifts.map((key, at) => {
                const gift = byKey.get(key)
                if (!gift) return null
                const name = getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, lang)
                const mark = !target || held?.key === key ? null : over.before === key ? '-left-[0.1875rem]' : over.before === null && at === group.gifts.length - 1 ? '-right-[0.1875rem]' : null
                return (
                  <li key={key} data-preset-chip={key} className={`relative w-11 lg:w-[3.25rem] ${held?.key === key ? 'opacity-40' : ''}`} onKeyDown={event => step(index, key, event)}>
                    {mark && <span data-drop-mark aria-hidden className={`pointer-events-none absolute inset-y-0 z-20 w-0.5 rounded bg-[#e8b030] ${mark}`} />}
                    <GiftCard gift={gift} giftId={gift.id} showName={false} ariaLabel={t('presetGiftRemove', { name })} title={name} onClick={() => onChange(removeGift(preset, key))} />
                  </li>
                )
              })}
            </ul>
            <textarea maxLength={GIFT_PRESET_MEMO_MAX} rows={2} aria-label={t('presetMemoLabel', { name: label(index) })} placeholder={t('presetMemo')} value={group.memo}
              onChange={event => editGroup(index, { memo: event.target.value })}
              className={`${FIELD} mt-2 block w-full resize-none py-1.5 text-[0.8125rem] leading-[1.5]`} />
          </section>
        )
      })}

      <button type="button" disabled={!canAdd} onClick={add}
        className="hidden h-9 items-center justify-center gap-1.5 rounded border border-dashed border-[#3a2a15] text-[0.875rem] text-[#9c8b73] transition-colors hover:border-[#5a4526] hover:text-[#e8dcc8] disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none lg:flex"
        style={{ fontFamily: 'var(--font-heading)' }}>
        <Plus size={15} aria-hidden />{t('presetGroupAdd')}
      </button>
    </div>
  )
}

/** Takes a preset code typed or pasted in; `onSubmit` answers whether it was taken. */
function PresetCodeDialog({ open, onSubmit, onClose }: { open: boolean; onSubmit: (code: string) => Promise<boolean>; onClose: () => void }) {
  const t = useTranslations('mirrorDungeonPage')
  const common = useTranslations('common')
  const [code, setCode] = useState('')
  const close = () => { setCode(''); onClose() }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (code.trim() && await onSubmit(code)) close()
  }
  return (
    <BaseModal open={open} onClose={close} title={t('presetCodeImport')} maxWidth="26rem" zIndex={9999}>
      <form className="popup-confirm" onSubmit={submit}>
        <h2>{t('presetCodeImport')}</h2>
        <textarea rows={4} aria-label={t('presetCode')} placeholder={t('presetCode')} value={code} onChange={event => setCode(event.target.value)} spellCheck={false}
          className="block w-full resize-none break-all rounded-md border border-[#5a4526] bg-[#070604] px-3 py-2 text-[0.8125rem] leading-[1.5] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
        <div className="popup-actions">
          <button type="button" onClick={close}>{common('cancel')}</button>
          <button type="submit" className="popup-primary disabled:cursor-not-allowed disabled:opacity-50" disabled={!code.trim()}>{t('presetCodeLoad')}</button>
        </div>
      </form>
    </BaseModal>
  )
}

interface GiftPresetModalProps {
  open: boolean
  presets: GiftPresets
  gifts: EgoGift[]
  keywordOrder: readonly string[]
  getGiftKeywordIcon: (keyword: string) => string | null
  onChange: (presets: GiftPresets) => void
  onClose: () => void
}

/**
 * The preset editor, laid out like the planner's gift picker with a second column: the gift list on the left and the
 * preset (name, groups, memos) on the right. Narrower than lg the preset sits above the list, since a list column beside
 * it would be too narrow to browse. A gift is dragged into a group, or pressed to go into the chosen group. Changes apply
 * as they are made.
 */
export default function GiftPresetModal({ open, presets, gifts, keywordOrder, getGiftKeywordIcon, onChange, onClose }: GiftPresetModalProps) {
  const t = useTranslations('mirrorDungeonPage')
  const filters = useGiftCatalogFilters()
  const [editing, setEditing] = useState<string | null>(null)
  const [selected, setSelected] = useState(0)
  const [pending, setPending] = useState<'preset' | { group: number } | null>(null)
  const [importing, setImporting] = useState(false)
  const codec = useRef<typeof import('@/lib/mirror-dungeon/gift-preset-code') | null>(null)
  // Loaded when the editor opens: the clipboard is only written to inside the press that asked for it.
  useEffect(() => {
    if (open && !codec.current) import('@/lib/mirror-dungeon/gift-preset-code').then(mod => { codec.current = mod }).catch(() => {})
  }, [open])

  const preset = presets.list.find(item => item.id === editing) ?? presets.list.find(item => item.id === presets.active) ?? presets.list[0]
  const group = preset ? Math.min(selected, preset.groups.length - 1) : 0
  const full = presets.list.length >= GIFT_PRESET_LIMIT
  const presetName = (item: GiftPreset) => item.name.trim() || t('preset')
  const groupName = (index: number) => preset?.groups[index]?.name.trim() || t('presetGroupNumbered', { number: index + 1 })

  const byId = useMemo(() => new Map(gifts.map(gift => [gift.id, gift])), [gifts])
  const byKey = useMemo(() => new Map(gifts.map(gift => [giftCheckKey(gift), gift])), [gifts])
  // In the list: a check on the chosen group's gifts, and the gifts of the other groups dimmed.
  const [chosenIds, otherIds] = useMemo(() => {
    const ids = (keys: string[]) => new Set(keys.flatMap(key => byKey.get(key)?.id ?? []))
    return [ids(preset?.groups[group]?.gifts ?? []), ids(preset?.groups.flatMap((item, index) => index === group ? [] : item.gifts) ?? [])]
  }, [preset, group, byKey])

  const save = (next: GiftPreset) => onChange({ ...presets, list: presets.list.map(item => item.id === next.id ? next : item) })
  const full60 = () => showError(t('presetGiftFull', { count: GIFT_PRESET_GIFT_LIMIT }))
  const press = (gift: EgoGift) => {
    if (!preset) return
    const next = toggleGift(preset, giftCheckKey(gift), group)
    if (next === preset) full60()
    else save(next)
  }
  const drop = (held: HeldGift, spot: DropSpot) => {
    if (!preset) return
    const next = placeGift(preset, held.key, spot.group, spot.before)
    if (next !== preset) save(next)
    else if (held.from === null && presetGiftCount(preset) >= GIFT_PRESET_GIFT_LIMIT) full60()
    setSelected(spot.group)
  }
  const drag = useGiftDrag(open, id => { const gift = byId.get(id); return gift && giftCheckKey(gift) }, drop)
  const heldGift = drag.held ? byKey.get(drag.held.key) : undefined

  const create = (body?: GiftPresetBody) => {
    const next = createPreset(presets, t('presetNumbered', { number: presets.list.length + 1 }), body)
    if (!next) { showError(t('presetLimit', { count: GIFT_PRESET_LIMIT })); return false }
    onChange(next)
    setEditing(next.active)
    setSelected(0)
    return true
  }
  const copy = async () => {
    if (!preset) return
    try {
      const { encodePresetCode } = codec.current ?? await import('@/lib/mirror-dungeon/gift-preset-code')
      await navigator.clipboard.writeText(encodePresetCode(preset))
      showSuccess(t('presetCodeCopied'))
    } catch {
      showError(t('presetCodeCopyFailed'))
    }
  }
  const load = async (code: string) => {
    try {
      const body = (codec.current ?? await import('@/lib/mirror-dungeon/gift-preset-code')).decodePresetCode(code)
      if (!body) { showError(t('presetCodeInvalid')); return false }
      if (!create(body)) return false
      showSuccess(t('presetCodeImported'))
      return true
    } catch {
      showError(t('presetCodeInvalid'))
      return false
    }
  }
  const askRemoveGroup = (index: number) => {
    const target = preset?.groups[index]
    if (target && (target.gifts.length || target.memo.trim())) setPending({ group: index })
    else removeGroupAt(index)
  }
  const removeGroupAt = (index: number) => {
    if (!preset) return
    save(removeGroup(preset, index))
    setSelected(current => current > index ? current - 1 : current)
  }
  const confirmPending = () => {
    if (!preset || !pending) return
    setPending(null)
    if (pending !== 'preset') { removeGroupAt(pending.group); showSuccess(t('presetGroupDeleted')); return }
    const next = deletePreset(presets, preset.id)
    onChange(next)
    setEditing(null)
    setSelected(0)
    showSuccess(t('presetDeleted'))
    if (!next.list.length) onClose()
  }

  return (
    <>
      <BaseModal open={open} onClose={onClose} title={t('presetEdit')} maxWidth="76rem" sheet>
        <div {...drag.handlers}
          className={`flex h-[100dvh] flex-col border border-[rgba(200,144,10,0.22)] bg-[#17120c] shadow-[0_1.5rem_3rem_rgba(0,0,0,0.55)] sm:h-[min(92dvh,58rem)] ${drag.held ? 'cursor-grabbing select-none' : ''}`}>
          <div className="flex shrink-0 items-center gap-1 border-b border-[#2e2417] py-1.5 pl-4 pr-1.5 lg:pl-5">
            {preset && (
              <Dropdown ariaLabel={t('presetSelect')} value={preset.id} minWidth={200} className="min-w-0"
                options={presets.list.map(item => ({ value: item.id, label: presetName(item) }))}
                onChange={id => { setEditing(id); setSelected(0) }}
                buttonStyle={{ minHeight: '2.5rem', maxWidth: '16rem', padding: '0 0.75rem', fontSize: '0.9375rem', color: 'var(--text-primary)', borderColor: '#2e2417', background: '#0d0b08' }} />
            )}
            <p className="shrink-0 px-1.5 tabular-nums text-[#9c8b73]" style={NUMBER}>{presets.list.length}/{GIFT_PRESET_LIMIT}</p>
            <button type="button" aria-label={t('presetNew')} title={t('presetNew')} aria-disabled={full} onClick={() => { if (create()) showSuccess(t('presetCreated')) }}
              className={`${ICON} ${full ? 'opacity-40' : ''}`}>
              <Plus size={18} aria-hidden />
            </button>
            <button type="button" aria-label={t('presetCodeImport')} title={t('presetCodeImport')} aria-disabled={full}
              onClick={() => full ? showError(t('presetLimit', { count: GIFT_PRESET_LIMIT })) : setImporting(true)} className={`${ICON} ${full ? 'opacity-40' : ''}`}>
              <ClipboardPaste size={17} aria-hidden />
            </button>
            <button type="button" onClick={onClose} aria-label={t('close')} title={t('close')} className={`${ICON} ml-auto`}>
              <X size={18} aria-hidden />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row-reverse">
            {/* The gift list is the scrolling area. The preset scrolls only when its groups outgrow the window. */}
            <aside className="shrink-0 overflow-y-auto overscroll-contain border-b border-[#2e2417] bg-[#17120c] max-lg:max-h-[55%] lg:w-1/2 lg:border-b-0 lg:border-l">
              {preset && (
                <GiftPresetPanel preset={preset} gifts={gifts} selected={group} onSelect={setSelected} onChange={save} onRemoveGroup={askRemoveGroup}
                  held={drag.held} over={drag.over}
                  actions={<>
                    <button type="button" aria-label={t('presetCodeCopy')} title={t('presetCodeCopy')} onClick={copy} className={ICON}><Copy size={16} aria-hidden /></button>
                    <button type="button" aria-label={t('presetDelete')} title={t('presetDelete')} onClick={() => setPending('preset')} className={`${ICON} hover:text-[#ff9c9c]`}><Trash2 size={16} aria-hidden /></button>
                  </>} />
              )}
            </aside>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 lg:px-5 lg:pb-5">
              <div className="pt-3 lg:pt-4" style={{ '--gift-catalog-bg': 'var(--bg-card)', '--gift-catalog-sticky-top': '-1px', '--gift-catalog-min-h': '0px', '--gift-catalog-cell': '3.25rem' } as CSSProperties}>
                <GiftCatalog compact gifts={gifts} getGiftKeywordIcon={getGiftKeywordIcon} filters={filters} keywordOrder={keywordOrder}
                  selectedIds={chosenIds} markedIds={otherIds} markedLabel={t('presetOtherGroup')} onGiftClick={press} />
              </div>
            </div>
          </div>
        </div>
      </BaseModal>
      {open && heldGift && createPortal(
        <div ref={drag.ghostRef} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[10000] w-[3.5rem] drop-shadow-[0_0.5rem_0.75rem_rgba(0,0,0,0.7)]" style={{ willChange: 'transform' }}>
          <GiftArtwork gift={heldGift} displayName="" />
        </div>,
        document.body,
      )}
      <PresetCodeDialog open={importing} onSubmit={load} onClose={() => setImporting(false)} />
      <ConfirmModal open={pending !== null} variant="danger" confirmLabel={t('presetDelete')}
        message={t('presetDeleteConfirm', { name: pending === 'preset' && preset ? presetName(preset) : pending && pending !== 'preset' ? groupName(pending.group) : '' })}
        onCancel={() => setPending(null)} onConfirm={confirmPending} />
    </>
  )
}

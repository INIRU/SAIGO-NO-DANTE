'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { Bookmark, Check, ChevronDown, FolderOpen, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { showError, showSuccess } from '@/lib/toast'
import { formatShortDateTime } from '@/lib/utils/format-date'
import {
  GUEST_SLOTS, MAX_PRESET_NAME, PRESET_COOKIE, USER_SLOTS,
  decodePresetCookie, dropPreset, encodePresetCookie, pickedFinalKeys, presetLoadEdit, putPreset, type FinalPreset,
} from '@/features/planner/lib/final-presets'
import type { GiftData, PlannerAction } from '@/lib/planner/types'

const API = '/api/planner/final-presets'
const STRIP = 6
type Pending = { kind: 'overwrite' | 'load' | 'delete'; preset: FinalPreset }

function readCookie() {
  return decodePresetCookie(document.cookie.split('; ').find(c => c.startsWith(PRESET_COOKIE + '='))?.slice(PRESET_COOKIE.length + 1))
}
function writeCookie(presets: FinalPreset[]) {
  const value = presets.length ? encodePresetCookie(presets) : ''
  document.cookie = PRESET_COOKIE + '=' + value + '; Path=/; Max-Age=' + (presets.length ? 31536000 : 0) + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '')
}

/** Named final-gift selections: account slots when logged in, a small cookie otherwise. Only user-picked final_ keys are saved. */
export default function FinalGiftPresets({ inventory, dispatch, giftMap }: {
  inventory: readonly string[]
  dispatch: React.Dispatch<PlannerAction>
  giftMap: Map<number, GiftData>
}) {
  const t = useTranslations('planner.finalPresets')
  const locale = useLocale()
  const { status } = useSession()
  const user = status === 'authenticated'
  const slotCount = user ? USER_SLOTS : GUEST_SLOTS
  const [presets, setPresets] = useState<FinalPreset[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<{ slot: number; value: string } | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const picked = pickedFinalKeys(inventory)

  // The header often sits low on screen; bring the whole panel into view when it opens.
  useEffect(() => { if (open) panel.current?.scrollIntoView({ block: 'nearest' }) }, [open])

  useEffect(() => {
    if (status === 'loading') return
    if (!user) { setPresets(readCookie()); return }
    let live = true
    fetch(API).then(res => res.ok ? res.json() : Promise.reject())
      .then(body => { if (live) { setPresets(body.presets); setLoadError(false) } })
      .catch(() => { if (live) { setPresets([]); setLoadError(true) } })
    return () => { live = false }
  }, [status, user])

  useEffect(() => {
    if (!open || pending) return
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close) }
  }, [open, pending])

  /** Writes one slot (or clears it with null) and returns whether it stuck. */
  const persist = useCallback(async (slot: number, next: Omit<FinalPreset, 'slot' | 'updatedAt'> | null) => {
    const current = presets ?? []
    setBusy(true)
    try {
      if (user) {
        const res = next
          ? await fetch(API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot, name: next.name, gift_keys: next.giftKeys }) })
          : await fetch(API + '?slot=' + slot, { method: 'DELETE' })
        if (!res.ok) throw Error()
        setPresets(next ? putPreset(current, (await res.json()).preset) : dropPreset(current, slot))
      } else {
        const list = next ? putPreset(current, { ...next, slot, updatedAt: new Date().toISOString() }) : dropPreset(current, slot)
        writeCookie(list)
        setPresets(list)
      }
      return true
    } catch (error) {
      showError(t(error instanceof Error && error.message === 'too_large' ? 'tooLarge' : 'saveFailed'))
      return false
    } finally {
      setBusy(false)
    }
  }, [presets, t, user])

  const save = async (slot: number, presetName: string) => {
    if (await persist(slot, { name: presetName, giftKeys: picked })) { setName(''); showSuccess(t('saved', { name: presetName })) }
  }
  const load = (preset: FinalPreset) => {
    const { remove, add } = presetLoadEdit(inventory, preset.giftKeys)
    for (const giftId of remove) dispatch({ type: 'REMOVE_GIFT', giftId })
    for (const giftId of add) dispatch({ type: 'ADD_GIFT', giftId })
    setOpen(false)
    showSuccess(t('loaded', { name: preset.name }))
  }
  const confirmPending = async () => {
    if (!pending) return
    const { kind, preset } = pending
    setPending(null)
    if (kind === 'load') load(preset)
    else if (kind === 'overwrite') await save(preset.slot, name.trim() || preset.name)
    else if (await persist(preset.slot, null)) showSuccess(t('deleted', { name: preset.name }))
  }
  const rename = async () => {
    const preset = presets?.find(p => p.slot === renaming?.slot)
    const value = renaming?.value.trim()
    if (!preset || !value) return
    if (value === preset.name || await persist(preset.slot, { name: value, giftKeys: preset.giftKeys })) setRenaming(null)
  }

  const bySlot = new Map((presets ?? []).map(p => [p.slot, p]))
  const iconButton = 'grid h-9 w-9 shrink-0 place-items-center rounded border border-[#2e2417] text-[#a8894e] hover:text-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)] disabled:opacity-40'
  const textButton = 'inline-flex min-h-9 items-center gap-1 rounded border px-2 text-[0.875rem] font-semibold focus-visible:outline-2 focus-visible:outline-[var(--gold-light)] disabled:cursor-not-allowed disabled:opacity-40'
  const goldButton = textButton + ' border-[rgba(200,144,10,0.25)] bg-[rgba(200,144,10,0.1)] font-bold text-[var(--gold-light)] hover:bg-[rgba(200,144,10,0.2)]'
  const plainButton = textButton + ' border-[#2e2417] text-[var(--text-primary)] hover:bg-[rgba(232,220,200,0.06)]'

  return (
    <div ref={root} className="relative ml-auto self-center">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-haspopup="dialog" disabled={presets === null}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[rgba(200,144,10,0.3)] bg-[rgba(200,144,10,0.1)] px-2.5 text-[0.9375rem] font-semibold text-[var(--gold-light)] transition-colors hover:bg-[rgba(200,144,10,0.18)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)] disabled:opacity-50">
        <Bookmark size={13} aria-hidden="true" />
        {t('button')}
        <span className="text-[0.8125rem] font-medium tabular-nums text-[#a8894e]">{presets?.length ?? 0}/{slotCount}</span>
        <ChevronDown size={13} aria-hidden="true" className={'transition-transform motion-reduce:transition-none ' + (open ? 'rotate-180' : '')} />
      </button>
      {open && presets && (
        <div ref={panel} role="dialog" aria-label={t('title')}
          className="pop-in fixed inset-x-3 top-24 z-40 flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-lg border border-[rgba(200,144,10,0.25)] bg-[#17120c] shadow-[0_1rem_2.5rem_rgba(0,0,0,0.55)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[min(40rem,calc(100dvh-10rem))] sm:w-[27rem]">
          <div className="flex items-center justify-between border-b border-[#2e2417] px-3 py-2">
            <span className="text-[0.9375rem] font-bold text-[var(--text-primary)]">{t('title')}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('close')}
              className="grid h-9 w-9 place-items-center rounded text-[#a8894e] hover:text-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]"><X size={16} aria-hidden="true" /></button>
          </div>
          <div className="border-b border-[#2e2417] px-3 py-2.5">
            <label className="block text-[0.8125rem] text-[#9c8b73]" htmlFor="final-preset-name">{t('nameLabel')}</label>
            <input id="final-preset-name" value={name} onChange={event => setName(event.target.value)} maxLength={MAX_PRESET_NAME} placeholder={t('namePlaceholder')}
              className="mt-1 h-9 w-full rounded border border-[#2e2417] bg-[var(--bg-deep)] px-2.5 text-[0.9375rem] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:border-[var(--gold)] focus-visible:outline-none" />
            <p className="mt-1.5 text-[0.8125rem] text-[#8a7d69]">
              {picked.length ? t('current', { count: picked.length }) : t('noSelection')}
            </p>
          </div>
          {loadError && <p role="alert" className="border-b border-[#2e2417] px-3 py-2 text-[0.875rem] text-[#d0826a]">{t('unavailable')}</p>}
          <ul className="min-h-0 flex-1 divide-y divide-[#241c14] overflow-y-auto p-1.5">
            {Array.from({ length: slotCount }, (_, index) => index + 1).map(slot => {
              const preset = bySlot.get(slot)
              const editing = renaming?.slot === slot
              return (
                <li key={slot} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-2 px-1.5 py-2.5">
                  <span className={'grid h-7 w-7 place-items-center rounded text-[0.875rem] font-bold ' + (preset ? 'bg-[rgba(200,144,10,0.16)] text-[var(--gold-light)]' : 'bg-[#1f1810] text-[var(--text-muted)]')}>{slot}</span>
                  {editing ? (
                    <input autoFocus value={renaming.value} maxLength={MAX_PRESET_NAME} aria-label={t('renameLabel', { name: preset?.name ?? '' })}
                      onChange={event => setRenaming({ slot, value: event.target.value })}
                      onKeyDown={event => { if (event.key === 'Enter') rename(); if (event.key === 'Escape') { event.stopPropagation(); setRenaming(null) } }}
                      className="h-9 min-w-0 rounded border border-[var(--gold)] bg-[var(--bg-deep)] px-2 text-[0.9375rem] text-[var(--text-primary)] focus-visible:outline-none" />
                  ) : (
                    <span className="min-w-0">
                      <span className={'block truncate text-[0.9375rem] font-semibold ' + (preset ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]')}>{preset?.name ?? t('emptySlot')}</span>
                      {preset && (
                        <span className="flex gap-2 text-[0.8125rem] text-[#8a7d69]">
                          <span className="tabular-nums text-[#a8894e]">{t('giftCount', { count: preset.giftKeys.length })}</span>
                          <span>{formatShortDateTime(locale, preset.updatedAt)}</span>
                        </span>
                      )}
                    </span>
                  )}
                  <span className="flex gap-1">
                    {editing ? <>
                      <button type="button" onClick={rename} disabled={busy} aria-label={t('saveName')} className={iconButton}><Check size={14} aria-hidden="true" /></button>
                      <button type="button" onClick={() => setRenaming(null)} aria-label={t('cancel')} className={iconButton}><X size={14} aria-hidden="true" /></button>
                    </> : preset ? <>
                      <button type="button" onClick={() => setRenaming({ slot, value: preset.name })} aria-label={t('renameLabel', { name: preset.name })} className={iconButton}><Pencil size={13} aria-hidden="true" /></button>
                      <button type="button" onClick={() => setPending({ kind: 'delete', preset })} disabled={busy} aria-label={t('deleteLabel', { name: preset.name })} className={iconButton + ' text-[#c08a74] hover:text-[#d0826a]'}><Trash2 size={13} aria-hidden="true" /></button>
                    </> : (
                      <button type="button" onClick={() => save(slot, name.trim() || t('defaultName', { slot }))} disabled={busy || !picked.length || loadError} className={goldButton}>
                        <Plus size={13} aria-hidden="true" />{t('add')}
                      </button>
                    )}
                  </span>
                  {preset && !editing && (
                    <div className="col-span-2 col-start-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
                        {preset.giftKeys.slice(0, STRIP).map(key => {
                          const gift = giftMap.get(Number(key.split('_')[1]))
                          return gift?.image_url
                            ? <Image key={key} src={gift.image_url} alt="" width={24} height={24} className="h-6 w-6 shrink-0 object-contain" />
                            : <span key={key} className="h-6 w-6 shrink-0 rounded bg-[#1f1810]" />
                        })}
                        {preset.giftKeys.length > STRIP && <span className="ml-1 text-[0.8125rem] tabular-nums text-[#8a7d69]">+{preset.giftKeys.length - STRIP}</span>}
                      </span>
                      <span className="ml-auto flex shrink-0 gap-1">
                        <button type="button" onClick={() => setPending({ kind: 'overwrite', preset })} disabled={busy || !picked.length} className={goldButton}>
                          <Save size={13} aria-hidden="true" />{t('overwrite')}
                        </button>
                        <button type="button" onClick={() => picked.length ? setPending({ kind: 'load', preset }) : load(preset)} className={plainButton}>
                          <FolderOpen size={13} aria-hidden="true" />{t('load')}
                        </button>
                      </span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="border-t border-[#2e2417] px-3 py-2 text-[0.8125rem] text-[#8a7d69]">{t(user ? 'userNote' : 'guestNote', { slots: slotCount })}</p>
        </div>
      )}
      <ConfirmModal
        open={pending !== null}
        title={pending ? t(pending.kind + 'Title') : undefined}
        message={pending ? t(pending.kind + 'Message', { name: pending.preset.name, count: picked.length }) : ''}
        confirmLabel={pending ? t(pending.kind === 'delete' ? 'delete' : pending.kind) : undefined}
        cancelLabel={t('cancel')}
        variant={pending?.kind === 'delete' ? 'danger' : pending?.kind === 'load' ? 'warning' : 'default'}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}

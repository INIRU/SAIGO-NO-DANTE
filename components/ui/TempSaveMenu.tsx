'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronDown, FolderOpen, Save, Trash2, X } from 'lucide-react'
import type { TempSlot } from '@/lib/drafts/temp-slots'

/**
 * Five browser-local save slots behind one button: save or overwrite, load, and clear each slot. Shared by the planner,
 * the deck builder and Assist; each page owns what a slot holds.
 */
export default function TempSaveMenu<T>({ title, slots, onSave, onLoad, onDelete }: {
  /** Menu name, e.g. "플래너 임시 저장". */
  title: string
  slots: TempSlot<T>[]
  onSave: (slot: TempSlot<T>) => void
  onLoad: (slot: TempSlot<T>) => void
  onDelete: (slot: TempSlot<T>) => void
}) {
  const t = useTranslations('planner.tempSaves')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close) }
  }, [open])
  const savedAt = (value: string) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
  }
  const used = slots.filter(slot => slot.draft).length
  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-haspopup="menu"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[rgba(200,144,10,0.3)] bg-[rgba(200,144,10,0.1)] px-2.5 text-[0.9375rem] font-semibold text-[#e8b030] transition-colors hover:bg-[rgba(200,144,10,0.18)] focus-visible:outline-2 focus-visible:outline-[#e8b030]">
        <Save size={13} aria-hidden="true" />
        <span className="max-sm:sr-only">{t('button')}</span>
        <span className="text-[0.8125rem] font-medium text-[#a8894e]">{used}/{slots.length}</span>
        <ChevronDown size={13} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" aria-label={title}
          className="fixed inset-x-3 top-36 z-40 overflow-hidden rounded-lg border border-[rgba(200,144,10,0.25)] bg-[#17120c] shadow-[0_1rem_2.5rem_rgba(0,0,0,0.55)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[25rem]">
          <div className="flex items-center justify-between border-b border-[#2e2417] px-3 py-2">
            <span className="text-[0.9375rem] font-bold text-[#e8dcc8]">{title}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('closeMenu')}
              className="grid h-9 w-9 place-items-center rounded text-[#a8894e] hover:text-[#e8b030] focus-visible:outline-2 focus-visible:outline-[#e8b030]"><X size={16} aria-hidden="true" /></button>
          </div>
          <ul className="divide-y divide-[#241c14] p-1.5">
            {slots.map(slot => (
              <li key={slot.slotNumber} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 px-1.5 py-2.5">
                <span className={`grid h-7 w-7 place-items-center rounded text-[0.875rem] font-bold ${slot.draft ? 'bg-[rgba(200,144,10,0.16)] text-[#e8b030]' : 'bg-[#1f1810] text-[#6b5f4f]'}`}>{slot.slotNumber}</span>
                <span className="min-w-0">
                  <span className={`block truncate text-[0.9375rem] font-semibold ${slot.draft ? 'text-[#e8dcc8]' : 'text-[#7d7160]'}`}>{slot.draft?.label ?? t('emptySlot')}</span>
                  {slot.draft && <span className="block text-[0.8125rem] text-[#8a7d69]">{savedAt(slot.draft.savedAt)}</span>}
                </span>
                <span className="flex gap-1">
                  <button type="button" role="menuitem" onClick={() => onSave(slot)}
                    className="inline-flex min-h-9 items-center gap-1 rounded border border-[rgba(200,144,10,0.25)] bg-[rgba(200,144,10,0.1)] px-2 text-[0.875rem] font-bold text-[#e8b030] hover:bg-[rgba(200,144,10,0.2)] focus-visible:outline-2 focus-visible:outline-[#e8b030]">
                    <Save size={13} aria-hidden="true" />{t(slot.draft ? 'overwriteSlot' : 'saveToSlot')}
                  </button>
                  {slot.draft && <>
                    <button type="button" role="menuitem" onClick={() => { onLoad(slot); setOpen(false) }}
                      className="inline-flex min-h-9 items-center gap-1 rounded border border-[#2e2417] px-2 text-[0.875rem] font-semibold text-[#e8dcc8] hover:bg-[rgba(232,220,200,0.06)] focus-visible:outline-2 focus-visible:outline-[#e8b030]">
                      <FolderOpen size={13} aria-hidden="true" />{t('loadSlot')}
                    </button>
                    <button type="button" role="menuitem" onClick={() => onDelete(slot)} aria-label={t('deleteSlotLabel', { slot: slot.slotNumber })}
                      className="grid min-h-9 w-9 place-items-center rounded border border-[#2e2417] text-[#a16855] hover:text-[#d0826a] focus-visible:outline-2 focus-visible:outline-[#e8b030]">
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

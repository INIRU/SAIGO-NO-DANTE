'use client'

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import Image from 'next/image'
import { GripVertical, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import BaseModal from '@/components/ui/BaseModal'
import { giftKeywordLabel } from '@/components/gifts/GiftCatalog'
import type { SupportedLang } from '@/lib/i18n/types'
import { GIFT_KEYWORD_ORDER, moveItem } from '@/lib/mirror-dungeon/gift-check'

const ROW_REM = 2.5

interface KeywordOrderModalProps {
  open: boolean
  order: string[]
  onChange: (order: string[]) => void
  onClose: () => void
  getGiftKeywordIcon: (keyword: string) => string | null
}

/** Drag (or arrow keys) to reorder the gift keywords. The order is saved when a row is released. */
export default function KeywordOrderModal({ open, order, onChange, onClose, getGiftKeywordIcon }: KeywordOrderModalProps) {
  const t = useTranslations('mirrorDungeonPage')
  const lang = useLocale() as SupportedLang
  const listRef = useRef<HTMLOListElement>(null)
  // While a row is held the list shows `drag.order`; `top` is the held row's offset in the list, in px.
  const [drag, setDrag] = useState<{ key: string; grab: number; top: number; order: string[] } | null>(null)
  const shown = drag?.order ?? order
  const isDefault = order.every((key, i) => key === GIFT_KEYWORD_ORDER[i])

  const hold = (key: string, event: PointerEvent<HTMLButtonElement>) => {
    const list = listRef.current
    if (!list) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const row = event.currentTarget.getBoundingClientRect()
    setDrag({ key, grab: event.clientY - row.top, top: row.top - list.getBoundingClientRect().top, order })
  }
  const move = (event: PointerEvent) => {
    const list = listRef.current?.getBoundingClientRect()
    if (!drag || !list) return
    const row = list.height / order.length
    const top = Math.min(Math.max(event.clientY - list.top - drag.grab, 0), list.height - row)
    const to = Math.round(top / row)
    setDrag(held => {
      if (!held) return held
      const from = held.order.indexOf(held.key)
      return { ...held, top, order: to === from ? held.order : moveItem(held.order, from, to) }
    })
  }
  const release = () => {
    if (!drag) return
    if (drag.order !== order) onChange(drag.order)
    setDrag(null)
  }
  const step = (index: number, event: KeyboardEvent) => {
    const to = index + (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0)
    if (to === index || to < 0 || to >= order.length) return
    event.preventDefault()
    onChange(moveItem(order, index, to))
  }

  return (
    <BaseModal open={open} onClose={onClose} title={t('keywordOrder')} maxWidth="20rem">
      <div className="rounded-xl border border-[rgba(200,144,10,0.22)] bg-[#17120c] shadow-[0_1.5rem_3rem_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between gap-3 border-b border-[#2e2417] py-2 pl-5 pr-2">
          <h2 className="font-[family-name:var(--font-heading)] text-[1.0625rem] text-[var(--text-primary)]">{t('keywordOrder')}</h2>
          <button type="button" onClick={onClose} aria-label={t('close')}
            className="grid h-10 w-10 place-items-center rounded text-[#9c8b73] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>
        {/* Rows keep one DOM order and move by transform, so the held row keeps the pointer and the others slide. */}
        <ol ref={listRef} className="relative m-3 select-none" style={{ height: `${order.length * ROW_REM}rem` }}>
          {GIFT_KEYWORD_ORDER.map(key => {
            const index = shown.indexOf(key)
            const held = drag?.key === key
            const icon = getGiftKeywordIcon(key)
            const label = giftKeywordLabel(key, lang)
            return (
              <li key={key} className={`absolute inset-x-0 top-0 ${held ? 'z-10' : 'transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none'}`}
                style={{ height: `${ROW_REM}rem`, transform: held ? `translateY(${drag.top}px)` : `translateY(${index * ROW_REM}rem)` }}>
                <button type="button" aria-label={t('keywordOrderRow', { keyword: label, position: index + 1, total: order.length })}
                  onPointerDown={event => hold(key, event)} onPointerMove={move} onPointerUp={release} onPointerCancel={release}
                  onKeyDown={event => step(index, event)}
                  className={`flex h-[calc(100%-0.25rem)] w-full touch-none items-center gap-2.5 rounded border px-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)] ${held ? 'cursor-grabbing border-[var(--gold)] bg-[var(--bg-elevated)] shadow-[0_0.5rem_1rem_rgba(0,0,0,0.5)]' : 'cursor-grab border-[#2e2417] bg-[var(--bg-panel)] hover:border-[#5a4526]'}`}>
                  <span className="w-4 text-center tabular-nums text-[var(--text-muted)]" style={{ fontFamily: 'var(--font-title)', fontSize: '1.0625rem', lineHeight: 1 }}>{index + 1}</span>
                  <span className="grid h-[1.125rem] w-[1.125rem] shrink-0 place-items-center">
                    {icon && <Image src={icon} alt="" width={18} height={18} draggable={false} className="h-[1.125rem] w-[1.125rem]" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-heading)' }}>{label}</span>
                  <GripVertical size={16} aria-hidden className="shrink-0 text-[var(--text-muted)]" />
                </button>
              </li>
            )
          })}
        </ol>
        <div className="flex border-t border-[#2e2417] px-3 py-2">
          <button type="button" disabled={isDefault} onClick={() => onChange([...GIFT_KEYWORD_ORDER])}
            className="h-9 rounded px-2 text-[0.8125rem] text-[#9c8b73] transition-colors hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)]">
            {t('keywordOrderDefault')}
          </button>
        </div>
      </div>
    </BaseModal>
  )
}

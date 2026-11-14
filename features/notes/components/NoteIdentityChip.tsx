'use client'

import { useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useKeywords, useKeywordData } from '@/components/providers/KeywordProvider'
import { SIN_COLORS } from '@/lib/data/sinners'
import { useTranslations, useLocale } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import { localizeDeckKeyword } from '@/lib/decks/decks-types'
import { chipStyle } from '@/features/notes/lib/chip-style'
import type { NoteIdentityEntry } from '@/features/notes/lib/note-entries'
import { TooltipPopup, useTooltip } from './NoteTooltip'

export default function NoteIdentityChip({ entry }: { entry: NoteIdentityEntry }) {
  const t = useTranslations()
  const locale = useLocale()
  const keywords = useKeywords()
  const { sinMap: kwSinMap } = useKeywordData()
  const ref = useRef<HTMLSpanElement>(null)
  const { rect, show, scheduleHide, cancelHide, toggle } = useTooltip(ref)
  const mainKw = entry.keywords?.find(kw => kwSinMap[kw])
  const sinType = mainKw ? kwSinMap[mainKw] : undefined
  const sc = sinType ? (SIN_COLORS[sinType] ?? '#c8900a') : '#c8900a'
  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onClick={toggle}
      style={chipStyle(sc)}
    >
      {entry.imageUrl && (
        <Image src={entry.imageUrl} alt="" width={16} height={16} style={{ width: '1rem', height: '1rem', borderRadius: '50%', objectFit: 'cover' }} />
      )}
      <span style={{ color: '#888899', fontSize: '0.75rem' }}>{entry.sinnerName}</span>
      <span style={{ color: sc, fontSize: '0.75rem', fontWeight: 600 }}>{entry.name}</span>

      {rect && createPortal(
        <TooltipPopup rect={rect} minWidth={180} maxWidth={280} onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
          <div style={{ color: sc, fontSize: '0.8125rem', fontWeight: 700, marginBottom: 4 }}>
            {entry.sinnerName} <span style={{ fontFamily: 'sans-serif' }}>·</span> {t(`identity.rarity.${entry.rarity}` as Parameters<typeof t>[0])}
          </div>
          <div style={{ color: '#c8a450', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
            {entry.name}
          </div>
          {entry.keywords && entry.keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {entry.keywords.map((kw, idx) => {
                const kwSin = kwSinMap[kw]
                const kwColor = kwSin ? (SIN_COLORS[kwSin] ?? '#888') : '#888'
                const localKwName = localizeDeckKeyword(kw, keywords[kw], locale as SupportedLang)
                return (
                  <span key={`${kw}-${idx}`} style={{ color: kwColor, fontSize: '0.75rem', fontWeight: 600 }}>{localKwName}</span>
                )
              })}
            </div>
          )}
        </TooltipPopup>,
        document.body,
      )}
    </span>
  )
}

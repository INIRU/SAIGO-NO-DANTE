'use client'

import { useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { GIFT_KEYWORD_COLORS } from '@/lib/constants/gift'
import { useFormatSkillDesc, useKeywords } from '@/components/providers/KeywordProvider'
import { useLocale } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import { localizeDeckKeyword } from '@/lib/decks/decks-types'
import { chipStyle } from '@/features/notes/lib/chip-style'
import type { NoteEgoGiftEntry } from '@/features/notes/lib/note-entries'
import { TooltipPopup, useTooltip } from './NoteTooltip'

const EGO_GIFT_KW_COLORS = GIFT_KEYWORD_COLORS

/** `label`: icon then name, no chip box (one-line card previews). */
export default function NoteEgoGiftChip({ entry, label = false }: { entry: NoteEgoGiftEntry; label?: boolean }) {
  const locale = useLocale()
  const keywords = useKeywords()
  const formatSkillDesc = useFormatSkillDesc()
  const ref = useRef<HTMLSpanElement>(null)
  const { rect, show, scheduleHide, cancelHide, toggle } = useTooltip(ref)
  const sc = EGO_GIFT_KW_COLORS[entry.keyword] ?? '#888'
  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onClick={toggle}
      style={label ? { display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle', margin: '0 0.125rem', cursor: 'default' } : chipStyle(sc)}
    >
      {entry.image_url && (
        <Image src={entry.image_url} alt="" width={16} height={16} style={{ objectFit: 'contain', flexShrink: 0 }} />
      )}
      <span style={{ color: sc, fontSize: label ? 'inherit' : '0.75rem', fontWeight: 600 }}>{entry.name}</span>

      {rect && createPortal(
        <TooltipPopup rect={rect} onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            {entry.image_url && (
              <Image src={entry.image_url} alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
            )}
            <span style={{ color: sc, fontSize: '0.8125rem', fontWeight: 700 }}>{entry.name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{localizeDeckKeyword(entry.keyword, keywords[entry.keyword], locale as SupportedLang)} {entry.grade}</span>
          </div>
          {entry.effect_base && (
            <div style={{ color: '#aaa', fontSize: '0.75rem', lineHeight: 1.55 }}>
              {formatSkillDesc(entry.effect_base, sc)}
            </div>
          )}
        </TooltipPopup>,
        document.body,
      )}
    </span>
  )
}
